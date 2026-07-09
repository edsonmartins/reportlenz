package dev.reportlenz.render.pipeline;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;

import dev.reportlenz.render.pipeline.ErroDeRender.JrxmlInvalido;
import dev.reportlenz.render.pipeline.ErroDeRender.PullProibido;

/**
 * Tarefa phase-1/1.3 — pipeline compile→fill→export em modo Push: o payload
 * (mapa já filtrado a montante, I-2) alimenta $F/$P e a coleção de itens
 * alimenta a tabela. Verificação extraindo o texto do PDF real.
 */
class PipelineDeRenderTest {

    private final PipelineDeRender pipeline =
            new PipelineDeRender(new CompiladorJrxml(), new CacheDeCompilacaoEmMemoria());

    /** Comprovante-mini no dialeto 7, contract-first: sem query em lugar nenhum. */
    private static final String COMPROVANTE_MINI = """
            <?xml version="1.0" encoding="UTF-8"?>
            <jasperReport name="comprovante_mini" pageWidth="595" pageHeight="842" columnWidth="555" \
            leftMargin="20" rightMargin="20" topMargin="30" bottomMargin="30">
            \t<dataset name="itens_ds">
            \t\t<field name="descricao" class="java.lang.String"/>
            \t\t<field name="quantidade" class="java.lang.Integer"/>
            \t</dataset>
            \t<parameter name="titulo" class="java.lang.String"/>
            \t<field name="cliente.nome" class="java.lang.String"/>
            \t<field name="itens" class="java.util.List"/>
            \t<title height="40">
            \t\t<element kind="textField" x="0" y="0" width="555" height="18">
            \t\t\t<expression><![CDATA[$P{titulo}]]></expression>
            \t\t</element>
            \t\t<element kind="textField" x="0" y="20" width="555" height="18">
            \t\t\t<expression><![CDATA["Cliente: " + $F{cliente.nome}]]></expression>
            \t\t</element>
            \t</title>
            \t<detail>
            \t\t<band height="120">
            \t\t\t<element kind="component" x="0" y="0" width="555" height="100">
            \t\t\t\t<component kind="table">
            \t\t\t\t\t<datasetRun subDataset="itens_ds">
            \t\t\t\t\t\t<dataSourceExpression><![CDATA[new net.sf.jasperreports.engine.data.JRBeanCollectionDataSource($F{itens})]]></dataSourceExpression>
            \t\t\t\t\t</datasetRun>
            \t\t\t\t\t<column kind="single" width="400">
            \t\t\t\t\t\t<columnHeader height="16">
            \t\t\t\t\t\t\t<element kind="staticText" x="0" y="0" width="400" height="16" bold="true">
            \t\t\t\t\t\t\t\t<text><![CDATA[Descrição]]></text>
            \t\t\t\t\t\t\t</element>
            \t\t\t\t\t\t</columnHeader>
            \t\t\t\t\t\t<detailCell height="14">
            \t\t\t\t\t\t\t<element kind="textField" x="0" y="0" width="400" height="14">
            \t\t\t\t\t\t\t\t<expression><![CDATA[$F{descricao}]]></expression>
            \t\t\t\t\t\t\t</element>
            \t\t\t\t\t\t</detailCell>
            \t\t\t\t\t</column>
            \t\t\t\t\t<column kind="single" width="155">
            \t\t\t\t\t\t<detailCell height="14">
            \t\t\t\t\t\t\t<element kind="textField" x="0" y="0" width="155" height="14" hTextAlign="Right">
            \t\t\t\t\t\t\t\t<expression><![CDATA[$F{quantidade}]]></expression>
            \t\t\t\t\t\t\t</element>
            \t\t\t\t\t\t</detailCell>
            \t\t\t\t\t</column>
            \t\t\t\t</component>
            \t\t\t</element>
            \t\t</band>
            \t</detail>
            </jasperReport>
            """;

    @Test
    void renderizaPushCompleto_payloadAlimentaCamposParametrosETabela() throws Exception {
        Map<String, Object> payload = new HashMap<>();
        payload.put("titulo", "Comprovante de Entrega nº 42");
        payload.put("cliente.nome", "Açougue São João");
        payload.put("itens", List.of(
                Map.of("descricao", "Linguiça artesanal", "quantidade", 12),
                Map.of("descricao", "Pão de alho", "quantidade", 30)));

        byte[] pdf = pipeline.renderizarPdf(COMPROVANTE_MINI, payload);

        try (PDDocument doc = Loader.loadPDF(pdf)) {
            String texto = new PDFTextStripper().getText(doc);
            assertThat(texto).contains("Comprovante de Entrega nº 42"); // $P do payload
            assertThat(texto).contains("Cliente: Açougue São João");     // $F pontuado do payload
            assertThat(texto).contains("Linguiça artesanal");            // linha 1 da tabela (coleção)
            assertThat(texto).contains("Pão de alho");                   // linha 2 da tabela
            assertThat(texto).contains("30");                            // quantidade
        }
    }

    @Test
    void recusaQueryNoRelatorioPrincipal() {
        String pull = COMPROVANTE_MINI.replace(
                "<parameter name=\"titulo\" class=\"java.lang.String\"/>",
                "<parameter name=\"titulo\" class=\"java.lang.String\"/>\n\t<query language=\"sql\"><![CDATA[SELECT 1]]></query>");
        assertThatThrownBy(() -> pipeline.renderizarPdf(pull, new HashMap<>()))
                .isInstanceOf(PullProibido.class)
                .hasMessageContaining("CONTRACT_PULL_FORBIDDEN");
    }

    @Test
    void recusaQueryEscondidaEmSubDataset() {
        String pull = COMPROVANTE_MINI.replace(
                "<field name=\"descricao\" class=\"java.lang.String\"/>",
                "<query language=\"sql\"><![CDATA[SELECT * FROM itens]]></query>\n\t\t<field name=\"descricao\" class=\"java.lang.String\"/>");
        assertThatThrownBy(() -> pipeline.renderizarPdf(pull, new HashMap<>()))
                .isInstanceOf(PullProibido.class)
                .hasMessageContaining("itens_ds");
    }

    @Test
    void recusaConnectionExpressionDeSubreport() {
        String pull = COMPROVANTE_MINI.replace(
                "<title height=\"40\">",
                """
                <title height="40">
                \t\t<element kind="subreport" x="0" y="0" width="100" height="10">
                \t\t\t<connectionExpression><![CDATA[$P{REPORT_CONNECTION}]]></connectionExpression>
                \t\t\t<expression><![CDATA["Sub.jasper"]]></expression>
                \t\t</element>""");
        assertThatThrownBy(() -> pipeline.renderizarPdf(pull, new HashMap<>()))
                .isInstanceOf(PullProibido.class)
                .hasMessageContaining("connectionExpression");
    }

    @Test
    void recusaJrxmlQueNaoCarrega() {
        assertThatThrownBy(() -> pipeline.renderizarPdf("<jasperReport name='x'><banda/></jasperReport>", new HashMap<>()))
                .isInstanceOf(JrxmlInvalido.class);
    }
}
