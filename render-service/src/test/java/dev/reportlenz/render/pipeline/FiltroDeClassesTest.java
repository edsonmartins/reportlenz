package dev.reportlenz.render.pipeline;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

import io.micrometer.observation.ObservationRegistry;
import net.sf.jasperreports.engine.DefaultJasperReportsContext;
import net.sf.jasperreports.engine.JasperCompileManager;
import net.sf.jasperreports.engine.JasperReport;
import net.sf.jasperreports.engine.util.JRLoader;
import net.sf.jasperreports.engine.util.JRSaver;

/**
 * Filtro de classes nativo do engine (ADR-021, change
 * filtro-de-classes-do-engine/2.2): segunda barreira que age no FILL.
 * Cenários: compile cache envenenado, bypass do G7 e PARIDADE com o
 * vocabulário legítimo do G7 (fonte única em SegurancaDeExpressoesTest).
 */
class FiltroDeClassesTest {

    private final CompiladorJrxml compilador = new CompiladorJrxml();

    @Test
    void filtroEstaLigadoPeloJasperreportsProperties() {
        assertThat(DefaultJasperReportsContext.getInstance()
                .getProperty("net.sf.jasperreports.report.class.filter.enabled")).isEqualTo("true");
    }

    /** Cache que devolve SEMPRE o relatório dado — simula entrada envenenada no Redis. */
    private static CacheDeCompilacao cacheQueDevolve(JasperReport envenenado) {
        return (jrxml, compilacao) -> envenenado;
    }

    /** Compila DIRETO pelo engine — sem anti-Pull nem G7 (como faria quem escreve no Redis). */
    private static JasperReport compilarSemG7(String jrxml) throws Exception {
        return JasperCompileManager.compileReport(new ByteArrayInputStream(jrxml.getBytes(StandardCharsets.UTF_8)));
    }

    /** Round-trip de serialização igual ao CacheDeCompilacaoCompartilhado (JRSaver/JRLoader). */
    private static JasperReport comoSeViesseDoRedis(JasperReport r) throws Exception {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        JRSaver.saveObject(r, bytes);
        return (JasperReport) JRLoader.loadObject(new ByteArrayInputStream(bytes.toByteArray()));
    }

    private static Map<String, Object> payload() {
        Map<String, Object> p = new HashMap<>();
        p.put("nome", "Ana");
        p.put("valor", 10.5);
        p.put("qtd", 2);
        p.put("data", new java.util.Date());
        p.put("titulo", "Fatura");
        return p;
    }

    @Test
    void cenarioDoSpec_compileCacheEnvenenadoEBloqueadoNoFill() throws Exception {
        JasperReport envenenado = comoSeViesseDoRedis(
                compilarSemG7(SegurancaDeExpressoesTest.jrxmlCom("String.valueOf(Runtime.getRuntime().availableProcessors())")));
        // O jrxml PEDIDO é inofensivo; o cache devolve o envenenado (o G7 nem roda).
        var pipeline = new PipelineDeRender(compilador, cacheQueDevolve(envenenado), ObservationRegistry.NOOP);
        assertThatThrownBy(() -> pipeline.renderizarPdf(SegurancaDeExpressoesTest.jrxmlCom("$F{nome}"), payload()))
                .isInstanceOf(ErroDeRender.FalhaDeRender.class)
                .hasStackTraceContaining("java.lang.Runtime is not visible to reports");
    }

    @Test
    void cenarioDoSpec_bypassDoG7NaoTocaOFilesystem(@org.junit.jupiter.api.io.TempDir Path tmp) throws Exception {
        Path alvo = tmp.resolve("criado-pelo-relatorio.txt");
        String expressao = "String.valueOf(new java.io.File(\"" + alvo.toString().replace("\\", "/") + "\").createNewFile())";
        JasperReport malicioso = compilarSemG7(SegurancaDeExpressoesTest.jrxmlCom(expressao));
        var pipeline = new PipelineDeRender(compilador, cacheQueDevolve(malicioso), ObservationRegistry.NOOP);
        assertThatThrownBy(() -> pipeline.renderizarPdf(SegurancaDeExpressoesTest.jrxmlCom("$F{nome}"), payload()))
                .isInstanceOf(ErroDeRender.FalhaDeRender.class)
                .hasStackTraceContaining("java.io.File is not visible to reports");
        assertThat(Files.exists(alvo)).isFalse();
    }

    @ParameterizedTest(name = "renderiza com filtro: {0}")
    @MethodSource("dev.reportlenz.render.pipeline.SegurancaDeExpressoesTest#vocabularioLegitimo")
    void cenarioDoSpec_paridade_vocabularioLegitimoRenderiza(String expressao) {
        var pipeline = new PipelineDeRender(compilador, new CacheDeCompilacaoEmMemoria(), ObservationRegistry.NOOP);
        byte[] pdf = pipeline.renderizarPdf(SegurancaDeExpressoesTest.jrxmlCom(expressao), payload());
        assertThat(new String(pdf, 0, 5)).isEqualTo("%PDF-");
    }

    private static final Path FIXTURES = Path.of("../tools/jr7-harness/fixtures");

    static boolean fixturesDisponiveis() {
        return Files.exists(FIXTURES.resolve("fatura.jrxml"));
    }

    /** Referências reais (tabela, QR, EAN13, grade, subreport por codename) com o filtro ligado. */
    @Test
    @EnabledIf("fixturesDisponiveis")
    void cenarioDoSpec_paridade_referenciasRenderizam() throws Exception {
        String filho = Files.readString(FIXTURES.resolve("fatura_entregas.jrxml"));
        Function<String, JasperReport> subreports = uri -> compilador.compilar(filho);
        var pipeline = new PipelineDeRender(compilador, new CacheDeCompilacaoEmMemoria(), ObservationRegistry.NOOP,
                new ContextoJasperRestrito(List.of(), subreports));

        Map<String, Object> fatura = new HashMap<>();
        fatura.put("categoria", "Serviços");
        fatura.put("cliente_nome", "Padaria");
        fatura.put("itens", List.of(Map.of("descricao", "Revisão", "valor", 10.0)));
        fatura.put("total", 10.0);
        fatura.put("entregas", List.of(Map.of("endereco", "Rua A", "previsao", "15/01")));

        Map<String, Map<String, Object>> payloads = Map.of(
                "fatura", fatura,
                "comprovante", Map.of("pedido", Map.of("numero", "1", "data", "2026-01-15", "qrPayload", "QR-1"),
                        "cliente", Map.of("nome", "Ana", "documento", "1"),
                        "itens", List.of(Map.of("produto", "X", "quantidade", 1, "unidade", "UN"))),
                "formulario", Map.of("nome", "Ana", "documento", "1", "nascimento", "1990-05-20", "ativo", true),
                "etiqueta_a4", Map.of("etiquetas", List.of(
                        Map.of("produto_nome", "Café", "preco", 9.9, "ean", "7890000000017"))));
        for (var e : payloads.entrySet()) {
            byte[] pdf = pipeline.renderizarPdf(Files.readString(FIXTURES.resolve(e.getKey() + ".jrxml")),
                    new HashMap<>(e.getValue()));
            assertThat(new String(pdf, 0, 5)).as(e.getKey()).isEqualTo("%PDF-");
        }
    }
}
