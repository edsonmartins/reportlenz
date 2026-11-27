package dev.reportlenz.render.pipeline;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;

import net.sf.jasperreports.engine.JasperPrint;

/**
 * Grade multi-registro em modo Push (ADR-015, change grade-multiregistro-push,
 * tarefas 2.1-2.2): com `reportlenz.datasource.campo`, cada item da coleção
 * vira uma linha do MESTRE — 9 etiquetas = grade 3×3 numa folha A4. Coleção
 * vazia → banda noData (sem erro de pipeline). Valores de topo alimentam $P.
 */
class GradeDeEtiquetasTest {

    private final PipelineDeRender pipeline = new PipelineDeRender(
            new CompiladorJrxml(), new CacheDeCompilacaoEmMemoria(), io.micrometer.observation.ObservationRegistry.NOOP);

    /** Etiqueta 3 colunas no arranjo do ADR-015 (fields mestre = itens da coleção). */
    private static final String ETIQUETA_GRADE = """
            <?xml version="1.0" encoding="UTF-8"?>
            <jasperReport name="etiqueta_grade" columnCount="3" pageWidth="595" pageHeight="842" \
            columnWidth="178" columnSpacing="10" printOrder="Horizontal" whenNoDataType="NoDataSection" \
            leftMargin="20" rightMargin="20" topMargin="30" bottomMargin="30">
            \t<property name="reportlenz.datasource.campo" value="etiquetas"/>
            \t<style name="base" default="true" fontName="DejaVu Sans" fontSize="8"/>
            \t<parameter name="filial" class="java.lang.String"/>
            \t<field name="produto_nome" class="java.lang.String"/>
            \t<field name="preco" class="java.math.BigDecimal"/>
            \t<title height="16">
            \t\t<element kind="textField" x="0" y="0" width="555" height="14">
            \t\t\t<expression><![CDATA["Filial: " + $P{filial}]]></expression>
            \t\t</element>
            \t</title>
            \t<detail>
            \t\t<band height="90" splitType="Prevent">
            \t\t\t<element kind="textField" x="2" y="2" width="174" height="20">
            \t\t\t\t<expression><![CDATA[$F{produto_nome}]]></expression>
            \t\t\t</element>
            \t\t\t<element kind="textField" x="2" y="24" width="174" height="14" bold="true" pattern="¤ #,##0.00">
            \t\t\t\t<expression><![CDATA[$F{preco}]]></expression>
            \t\t\t</element>
            \t\t</band>
            \t</detail>
            \t<noData height="20">
            \t\t<element kind="staticText" x="0" y="0" width="555" height="16">
            \t\t\t<text><![CDATA[Sem etiquetas no payload]]></text>
            \t\t</element>
            \t</noData>
            </jasperReport>
            """;

    private Map<String, Object> payloadComEtiquetas(int quantidade) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("filial", "Loja Centro");
        payload.put("etiquetas", java.util.stream.IntStream.rangeClosed(1, quantidade)
                .mapToObj(i -> Map.<String, Object>of(
                        "produto_nome", "Café Premium " + i + "kg",
                        "preco", 34.90 + i)) // Double → BigDecimal pela coerção POR ITEM
                .toList());
        return payload;
    }

    @Test
    void noveItensViramGrade3x3NumaFolhaComParametrosDeTopo() throws Exception {
        JasperPrint print = pipeline.preencher(ETIQUETA_GRADE, payloadComEtiquetas(9));
        assertThat(print.getPages()).hasSize(1); // 3 colunas × 3 linhas de 90pt

        byte[] pdf = pipeline.exportarPdf(print);
        try (PDDocument doc = Loader.loadPDF(pdf)) {
            String texto = new PDFTextStripper().getText(doc);
            for (int i = 1; i <= 9; i++) {
                assertThat(texto).contains("Café Premium " + i + "kg");
            }
            assertThat(texto).contains("R$ 35,90");          // coerção por item + pt-BR
            assertThat(texto).contains("Filial: Loja Centro"); // topo → $P{}
        }
    }

    @Test
    void colecaoVaziaOuAusenteCaiNaBandaNoDataSemErro() throws Exception {
        Map<String, Object> semItens = new HashMap<>();
        semItens.put("filial", "Loja Centro");
        semItens.put("etiquetas", List.of());

        JasperPrint print = pipeline.preencher(ETIQUETA_GRADE, semItens);
        try (PDDocument doc = Loader.loadPDF(pipeline.exportarPdf(print))) {
            assertThat(new PDFTextStripper().getText(doc)).contains("Sem etiquetas no payload");
        }

        Map<String, Object> semColecao = new HashMap<>();
        semColecao.put("filial", "X");
        assertThat(pipeline.preencher(ETIQUETA_GRADE, semColecao).getPages()).hasSize(1); // noData
    }

    @Test
    void semAPropertyNadaMuda_payloadEhUmRegistroMestre() throws Exception {
        String classico = ETIQUETA_GRADE.replace(
                "\t<property name=\"reportlenz.datasource.campo\" value=\"etiquetas\"/>\n", "");
        Map<String, Object> payload = new HashMap<>();
        payload.put("filial", "Loja Centro");
        payload.put("produto_nome", "Açúcar Cristal 5kg");
        payload.put("preco", 18.75);

        JasperPrint print = pipeline.preencher(classico, payload);
        try (PDDocument doc = Loader.loadPDF(pipeline.exportarPdf(print))) {
            String texto = new PDFTextStripper().getText(doc);
            assertThat(texto).contains("Açúcar Cristal 5kg"); // UMA etiqueta (registro único)
            assertThat(texto).contains("R$ 18,75");
        }
    }
}
