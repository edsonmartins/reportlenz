package dev.reportlenz.render.motor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.Callable;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;
import org.junit.jupiter.api.io.TempDir;

import dev.reportlenz.render.pipeline.ErroDeRender;
import dev.reportlenz.render.pipeline.FonteDeSubreports;

/**
 * Fachada do núcleo (ADR-026 §2, change backend-embarcavel/2.2) — Scenarios
 * "Renderizar pela API Java" e "Barreiras sempre ligadas".
 */
class MotorReportLenzTest {

    private static final Path FIXTURES = Path.of("../../tools/jr7-harness/fixtures");

    private static final String JRXML = """
            <?xml version="1.0" encoding="UTF-8"?>
            <jasperReport name="motor" pageWidth="595" pageHeight="842" columnWidth="555" \
            leftMargin="20" rightMargin="20" topMargin="30" bottomMargin="30">
            \t<parameter name="img" class="java.lang.String"/>
            \t<field name="nome" class="java.lang.String"/>
            \t<field name="valor" class="java.math.BigDecimal"/>
            \t<title height="60">
            \t\t<element kind="textField" x="0" y="0" width="555" height="20">
            \t\t\t<expression><![CDATA["Cliente: " + $F{nome} + " — ação"]]></expression>
            \t\t</element>
            \t\t<element kind="textField" x="0" y="22" width="555" height="20" pattern="¤ #,##0.00">
            \t\t\t<expression><![CDATA[$F{valor}]]></expression>
            \t\t</element>
            \t</title>
            </jasperReport>
            """;

    static boolean fixturesDisponiveis() {
        return Files.exists(FIXTURES.resolve("fatura.jrxml"));
    }

    private static String fixture(String nome) {
        try {
            return Files.readString(FIXTURES.resolve(nome + ".jrxml"));
        } catch (java.io.IOException e) {
            throw new java.io.UncheckedIOException(e);
        }
    }

    private static String texto(byte[] pdf) throws Exception {
        try (PDDocument doc = Loader.loadPDF(pdf)) {
            return new PDFTextStripper().getText(doc);
        }
    }

    private static Map<String, Object> payload(Object... chavesEValores) {
        Map<String, Object> m = new HashMap<>();
        for (int i = 0; i < chavesEValores.length; i += 2) m.put((String) chavesEValores[i], chavesEValores[i + 1]);
        return m;
    }

    @Test
    void renderizaPdfComCoercaoJsonELocalePtBr() throws Exception {
        MotorReportLenz motor = MotorReportLenz.builder().build();
        // Números JSON chegam como Double → BigDecimal; moeda pt-BR.
        byte[] pdf = motor.renderizarPdf(JRXML, payload("nome", "Padaria São João", "valor", 1234.5));
        assertThat(new String(pdf, 0, 5)).isEqualTo("%PDF-");
        assertThat(texto(pdf)).contains("Cliente: Padaria São João — ação", "R$ 1.234,50");
    }

    @Test
    void pngPorPaginaEFolhasTodas() {
        MotorReportLenz motor = MotorReportLenz.builder().build();
        byte[] png = motor.renderizarPng(JRXML, payload("nome", "X", "valor", 1), 0);
        assertThat(png).startsWith(new byte[] {(byte) 0x89, 'P', 'N', 'G'});
        assertThat(motor.renderizarPngs(JRXML, payload("nome", "X", "valor", 1))).hasSize(1);
    }

    @Test
    void g7SempreLigado_expressaoForaDaAllowlistERecusada() {
        MotorReportLenz motor = MotorReportLenz.builder().build();
        String rce = JRXML.replace("\"Cliente: \" + $F{nome} + \" — ação\"", "Runtime.getRuntime().exec(\"id\").toString()");
        assertThatThrownBy(() -> motor.renderizarPdf(rce, Map.of()))
                .isInstanceOf(ErroDeRender.ExpressaoProibida.class)
                .hasMessageContaining("Runtime");
    }

    @Test
    void contextoRestritoSempreLigado_imagemDeArquivoLocalERecusada(@TempDir Path tmp) throws Exception {
        Path imagem = tmp.resolve("x.png");
        java.awt.image.BufferedImage b = new java.awt.image.BufferedImage(2, 2, java.awt.image.BufferedImage.TYPE_INT_RGB);
        javax.imageio.ImageIO.write(b, "png", imagem.toFile());
        String comImagem = JRXML.replace("\t</title>", """
                \t\t<element kind="image" x="0" y="44" width="10" height="10" onErrorType="Error">
                \t\t\t<expression><![CDATA[$P{img}]]></expression>
                \t\t</element>
                \t</title>""");
        MotorReportLenz motor = MotorReportLenz.builder().build();
        assertThatThrownBy(() -> motor.renderizarPdf(comImagem, payload("nome", "x", "valor", 1, "img", imagem.toString())))
                .isInstanceOf(ErroDeRender.FalhaDeRender.class);
    }

    @Test
    void antiPullSempreLigado() {
        String pull = JRXML.replace("\t<parameter name=\"img\"", "\t<query language=\"sql\"><![CDATA[SELECT 1]]></query>\n\t<parameter name=\"img\"");
        assertThatThrownBy(() -> MotorReportLenz.builder().build().compilar(pull)).isInstanceOf(ErroDeRender.PullProibido.class);
    }

    @Test
    void validarPayloadContraOInputSchema() {
        MotorReportLenz motor = MotorReportLenz.builder().build();
        Map<String, Object> schema = Map.of("type", "object", "required", List.of("nome"),
                "properties", Map.of("nome", Map.of("type", "string")));
        motor.validarPayload(schema, Map.of("nome", "ok"));
        assertThatThrownBy(() -> motor.validarPayload(schema, Map.of()))
                .isInstanceOfSatisfying(ErroDeRender.PayloadForaDoContrato.class,
                        e -> assertThat(e.violacoes()).anyMatch(v -> v.contains("nome")));
    }

    @Test
    @EnabledIf("fixturesDisponiveis")
    void subreportsPelaFonteDaAplicacaoEG8() throws Exception {
        FonteDeSubreports fonte = ref -> "fatura_entregas".equals(ref.codename()) ? Optional.of(fixture("fatura_entregas")) : Optional.empty();
        MotorReportLenz motor = MotorReportLenz.builder().subreports(fonte).build();

        byte[] pdf = motor.renderizarPdf(fixture("fatura"), payload(
                "categoria", "Serviços", "cliente_nome", "Padaria São João",
                "itens", List.of(Map.of("descricao", "Revisão", "valor", 10.0)), "total", 10.0,
                "entregas", List.of(Map.of("endereco", "Rua das Flores, 100", "previsao", "15/01/2026"))));
        assertThat(texto(pdf)).contains("Entregas de Padaria São João", "Rua das Flores, 100");

        assertThat(motor.verificarGates(fixture("fatura"), null, "fatura").gates())
                .filteredOn(g -> g.gate().equals("G8")).singleElement()
                .satisfies(g -> assertThat(g.verde()).isTrue());
        // Sem a fonte, o G8 acusa e o render recusa o "repo:".
        MotorReportLenz semFonte = MotorReportLenz.builder().build();
        assertThat(semFonte.verificarGates(fixture("fatura"), null, "fatura").verde()).isFalse();
    }

    @Test
    void threadSafe_rendersConcorrentesComOMesmoMotor() throws Exception {
        MotorReportLenz motor = MotorReportLenz.builder().build();
        var executor = Executors.newFixedThreadPool(8);
        try {
            List<Callable<String>> tarefas = new ArrayList<>();
            for (int i = 0; i < 32; i++) {
                int n = i;
                tarefas.add(() -> texto(motor.renderizarPdf(JRXML, payload("nome", "Cliente " + n, "valor", n))));
            }
            List<Future<String>> resultados = executor.invokeAll(tarefas);
            for (int i = 0; i < resultados.size(); i++) {
                assertThat(resultados.get(i).get()).contains("Cliente: Cliente " + i + " —");
            }
        } finally {
            executor.shutdownNow();
        }
    }
}
