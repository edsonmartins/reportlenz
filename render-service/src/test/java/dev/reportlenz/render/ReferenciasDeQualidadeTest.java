package dev.reportlenz.render;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;

import dev.reportlenz.render.pipeline.CacheDeCompilacaoEmMemoria;
import dev.reportlenz.render.pipeline.CompiladorJrxml;
import dev.reportlenz.render.pipeline.PipelineDeRender;
import io.micrometer.observation.ObservationRegistry;
import net.sf.jasperreports.engine.JasperPrint;

/**
 * Aceite da Fase 3 (phase-3/9.2): os templates de referência do jrxml-core
 * (fixtures de `pnpm emit:fixtures`) são PRODUZIDOS de ponta a ponta pelo
 * MESMO pipeline da produção, com payload realista pt-BR — moeda R$,
 * acentuação, datas dd/MM e a grade multi-coluna de etiquetas A4.
 *
 * Também cobre a coerção de payload (CoercaoDePayload): números JSON chegam
 * como Double/Integer e datas como String; o fill exige BigDecimal/LocalDate.
 */
class ReferenciasDeQualidadeTest {

    private static final Path FIXTURES = Path.of("../tools/jr7-harness/fixtures");

    private final PipelineDeRender pipeline = new PipelineDeRender(
            new CompiladorJrxml(), new CacheDeCompilacaoEmMemoria(), ObservationRegistry.NOOP);

    static boolean fixturesDisponiveis() {
        return Files.exists(FIXTURES.resolve("fatura.jrxml"));
    }

    private String fixture(String nome) throws Exception {
        return Files.readString(FIXTURES.resolve(nome + ".jrxml"));
    }

    private String textoDoPdf(byte[] pdf) throws Exception {
        try (PDDocument doc = Loader.loadPDF(pdf)) {
            return new PDFTextStripper().getText(doc);
        }
    }

    @Test
    @EnabledIf("fixturesDisponiveis")
    void fatura_rendeComMoedaPtBrETotaisCalculados() throws Exception {
        Map<String, Object> payload = new HashMap<>();
        payload.put("titulo", "Fatura nº 2026-000123");
        payload.put("logo_url", "inexistente.png"); // onErrorType=Blank: não derruba o render
        payload.put("categoria", "Serviços de Manutenção");
        payload.put("cliente_nome", "Padaria São João Ltda.");
        // Números JSON chegam como Double — a coerção converte para BigDecimal.
        payload.put("itens", List.of(
                Map.of("descricao", "Revisão elétrica — salão", "valor", 1250.5),
                Map.of("descricao", "Troca de exaustor (peça + mão de obra)", "valor", 830.0),
                Map.of("descricao", "Manutenção preventiva câmara fria", "valor", 415.25)));
        payload.put("total", 2495.75); // contract-first: total calculado a montante
        // "entregas" omitido: o subreport tem printWhenExpression $F{entregas} != null.

        String texto = textoDoPdf(pipeline.renderizarPdf(fixture("fatura"), payload));

        assertThat(texto).contains("Fatura nº 2026-000123");
        assertThat(texto).contains("Padaria São João Ltda."); // acentuação intacta
        assertThat(texto).contains("Revisão elétrica — salão");
        assertThat(texto).contains("R$ 1.250,50"); // pattern ¤ #,##0.00 + REPORT_LOCALE pt-BR
        assertThat(texto).contains("Total geral");
        assertThat(texto).contains("R$ 2.495,75"); // $F{total} do payload no resumo
    }

    @Test
    @EnabledIf("fixturesDisponiveis")
    void comprovante_rendeComDataPtBrCabecalhoMescladoEQr() throws Exception {
        Map<String, Object> payload = new HashMap<>();
        payload.put("pedido", Map.of(
                "numero", "P-2026-042",
                "data", "2026-07-10", // String → LocalDate pela coerção
                "qrPayload", "https://exemplo.com.br/pedidos/P-2026-042"));
        payload.put("cliente", Map.of(
                "nome", "Açougue Três Irmãos",
                "documento", "12.345.678/0001-99",
                "endereco", "Av. das Nações, 1500 — São Paulo/SP"));
        payload.put("itens", List.of(
                Map.of("descricao", "Linguiça artesanal", "quantidade", 12.5, "unidade", "kg"),
                Map.of("descricao", "Pão de alho congelado", "quantidade", 30, "unidade", "un")));

        String texto = textoDoPdf(pipeline.renderizarPdf(fixture("comprovante"), payload));

        assertThat(texto).contains("P-2026-042");
        assertThat(texto).contains("10/07/2026"); // pattern dd/MM/yyyy sobre LocalDate coagido
        assertThat(texto).contains("Açougue Três Irmãos");
        assertThat(texto).contains("Linguiça artesanal");
    }

    @Test
    @EnabledIf("fixturesDisponiveis")
    void formulario_rendeComDataDeNascimentoEBooleano() throws Exception {
        Map<String, Object> payload = new HashMap<>();
        payload.put("titulo_ficha", "Ficha Cadastral de Fornecedor");
        payload.put("nome", "João das Couves & Cia.");
        payload.put("documento", "98.765.432/0001-10");
        payload.put("nascimento", "1987-03-21");
        payload.put("ativo", true);
        payload.put("observacoes", "Atende às sextas; entrega própria na região.");

        String texto = textoDoPdf(pipeline.renderizarPdf(fixture("formulario"), payload));

        assertThat(texto).contains("Ficha Cadastral de Fornecedor");
        assertThat(texto).contains("João das Couves & Cia.");
        assertThat(texto).contains("21/03/1987");
    }

    /**
     * Grade de etiquetas (RFC-004 §10 / ADR-015): o template de referência usa
     * `reportlenz.datasource.campo=etiquetas` — o PRÓPRIO pipeline Push dispõe
     * os 9 itens do payload em grade 3×3 numa única folha A4 (encerra a
     * pendência da nota-007 §4).
     */
    @Test
    @EnabledIf("fixturesDisponiveis")
    void etiquetaA4_gradeDe9ItensViaPipelinePushNumaFolha() throws Exception {
        List<Map<String, Object>> etiquetas = new ArrayList<>();
        for (int i = 1; i <= 9; i++) {
            etiquetas.add(Map.of(
                    "produto_nome", "Café Torrado Premium " + i + "kg",
                    "preco", 34.90 + i, // Double → BigDecimal pela coerção POR ITEM
                    "ean", "7891000315507")); // EAN-13 válido (dígito verificador correto)
        }
        Map<String, Object> payload = new HashMap<>();
        payload.put("etiquetas", etiquetas);

        JasperPrint print = pipeline.preencher(fixture("etiqueta_a4"), payload);
        // 9 etiquetas de 90pt em 3 colunas: cabem 3 linhas de grade → 1 página.
        assertThat(print.getPages()).hasSize(1);
        String texto = textoDoPdf(pipeline.exportarPdf(print));
        for (int i = 1; i <= 9; i++) {
            assertThat(texto).contains("Café Torrado Premium " + i + "kg");
        }
        assertThat(texto).contains("R$ 35,90");
    }

    /** Payload sem etiquetas → banda noData (whenNoDataType=NoDataSection). */
    @Test
    @EnabledIf("fixturesDisponiveis")
    void etiquetaA4_semItensCaiNaBandaNoData() throws Exception {
        Map<String, Object> payload = new HashMap<>();
        payload.put("etiquetas", List.of());
        String texto = textoDoPdf(pipeline.renderizarPdf(fixture("etiqueta_a4"), payload));
        assertThat(texto).contains("Sem etiquetas no payload");
    }
}
