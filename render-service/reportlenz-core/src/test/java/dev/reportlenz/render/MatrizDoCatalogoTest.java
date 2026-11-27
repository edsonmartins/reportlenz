package dev.reportlenz.render;

import static org.assertj.core.api.Assertions.assertThat;

import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Stream;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.BinaryBitmap;
import com.google.zxing.DecodeHintType;
import com.google.zxing.MultiFormatReader;
import com.google.zxing.NotFoundException;
import com.google.zxing.Result;
import com.google.zxing.client.j2se.BufferedImageLuminanceSource;
import com.google.zxing.common.HybridBinarizer;
import com.google.zxing.multi.GenericMultipleBarcodeReader;

import dev.reportlenz.render.pipeline.CacheDeCompilacaoEmMemoria;
import dev.reportlenz.render.pipeline.CompiladorJrxml;
import dev.reportlenz.render.pipeline.ContextoJasperRestrito;
import dev.reportlenz.render.pipeline.FonteDeSubreports;
import dev.reportlenz.render.pipeline.PipelineDeRender;
import dev.reportlenz.render.pipeline.ReferenciaDeSubreport;
import dev.reportlenz.render.pipeline.ValidadorDePayload;
import dev.reportlenz.render.publish.VerificadorDeGates;
import io.micrometer.observation.ObservationRegistry;
import net.sf.jasperreports.engine.JasperPrint;
import net.sf.jasperreports.engine.JasperPrintManager;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/**
 * Matriz do catálogo no ENGINE (ADR-022, change variacoes-de-templates/3.1):
 * para cada modelo de referência × cenário declarado no jrxml-core
 * (`<chave>.cenarios.json`, emitido pelo `pnpm emit:fixtures`) —
 * <ol>
 *   <li>payload validado contra o inputSchema (networknt, o MESMO do 422);</li>
 *   <li>compile com o G7 e fill com o filtro de classes (ADR-021) e o contexto
 *       restrito, subreports resolvidos por codename (ADR-020);</li>
 *   <li>PDF lido com PDFBox: textos, ausentes, faixa de páginas e textos que
 *       devem se repetir em TODAS as folhas;</li>
 *   <li>PNG da 1ª folha decodificado com ZXing: o código de barras é LEGÍVEL
 *       e contém exatamente o valor esperado (I2of5 do boleto, CODE-128 da
 *       chave do DANFE, QR, EAN-13).</li>
 * </ol>
 * Nenhum teste por modelo: modelo novo com cenários entra sozinho.
 */
class MatrizDoCatalogoTest {

    private static final Path FIXTURES = Path.of("../../tools/jr7-harness/fixtures");
    private static final JsonMapper JSON = JsonMapper.builder().build();
    /** Zoom do PNG de leitura: o preview usa 2× (144 dpi); barras finas pedem mais. */
    private static final float ZOOM_LEITURA = 4f;

    private final CompiladorJrxml compilador = new CompiladorJrxml();
    private final ContextoJasperRestrito contexto = new ContextoJasperRestrito(List.of(),
            uri -> compilador.compilar(fixture(ReferenciaDeSubreport.daLocalizacao(uri).codename())));
    private final PipelineDeRender pipeline = new PipelineDeRender(
            compilador, new CacheDeCompilacaoEmMemoria(), ObservationRegistry.NOOP, contexto);
    private final ValidadorDePayload validador = new ValidadorDePayload();

    record Caso(String modelo, String cenario, String descricao, Map<String, Object> payload, Map<String, Object> espera) {
        @Override
        public String toString() {
            return modelo + " · " + cenario;
        }
    }

    static boolean fixturesDisponiveis() {
        return Files.exists(FIXTURES.resolve("boleto.cenarios.json"));
    }

    static List<String> modelos() {
        try (Stream<Path> arquivos = Files.list(FIXTURES)) {
            return arquivos.map(p -> p.getFileName().toString())
                    .filter(n -> n.endsWith(".jrxml"))
                    .map(n -> n.substring(0, n.length() - ".jrxml".length()))
                    .sorted()
                    .toList();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    static String fixture(String modelo) {
        try {
            return Files.readString(FIXTURES.resolve(modelo + ".jrxml"));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    static Map<String, Object> schema(String modelo) {
        return JSON.readValue(FIXTURES.resolve(modelo + ".schema.json").toFile(), new TypeReference<Map<String, Object>>() {});
    }

    static List<Map<String, Object>> cenarios(String modelo) {
        return JSON.readValue(FIXTURES.resolve(modelo + ".cenarios.json").toFile(),
                new TypeReference<List<Map<String, Object>>>() {});
    }

    @SuppressWarnings("unchecked")
    static Stream<Caso> casos() {
        if (!fixturesDisponiveis()) {
            return Stream.empty();
        }
        return modelos().stream().flatMap(modelo -> cenarios(modelo).stream().map(c -> new Caso(
                modelo,
                (String) c.get("nome"),
                (String) c.get("descricao"),
                (Map<String, Object>) c.get("payload"),
                (Map<String, Object>) c.get("espera"))));
    }

    // -----------------------------------------------------------------------

    @Test
    @EnabledIf("fixturesDisponiveis")
    void catalogoCompletoComCenarios() {
        List<String> modelos = modelos();
        assertThat(modelos).hasSize(15);
        for (String modelo : modelos) {
            assertThat(FIXTURES.resolve(modelo + ".cenarios.json")).as(modelo).exists();
            if (!fixture(modelo).contains("value=\"subreport\"")) {
                assertThat(cenarios(modelo)).as("cenários de " + modelo).hasSizeGreaterThanOrEqualTo(2);
            }
        }
    }

    /** G1, G2, G7 e G8 do serviço verdes — o registro de subreports são os próprios fixtures. */
    @Test
    @EnabledIf("fixturesDisponiveis")
    void todoModeloPassaNosGatesDoServico() {
        FonteDeSubreports fonte = ref -> Files.exists(FIXTURES.resolve(ref.codename() + ".jrxml"))
                ? Optional.of(fixture(ref.codename()))
                : Optional.empty();
        VerificadorDeGates gates = new VerificadorDeGates(compilador, fonte);
        for (String modelo : modelos()) {
            VerificadorDeGates.Resultado r = gates.verificar(fixture(modelo), schema(modelo), null, modelo);
            assertThat(r.gates().stream().filter(g -> !g.verde()).map(g -> g.gate() + ": " + g.erros()).toList())
                    .as("gates de " + modelo)
                    .isEmpty();
        }
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("casos")
    @EnabledIf("fixturesDisponiveis")
    @SuppressWarnings("unchecked")
    void cenarioRenderizaComoDeclarado(Caso caso) throws Exception {
        validador.validar(schema(caso.modelo()), caso.payload());

        JasperPrint print = pipeline.preencher(fixture(caso.modelo()), caso.payload());
        Map<String, Object> espera = caso.espera();
        int paginas = print.getPages().size();

        Map<String, Object> faixa = (Map<String, Object>) espera.get("paginas");
        if (faixa != null) {
            assertThat(paginas).as("páginas mínimas").isGreaterThanOrEqualTo(((Number) faixa.get("min")).intValue());
            if (faixa.get("max") != null) {
                assertThat(paginas).as("páginas máximas").isLessThanOrEqualTo(((Number) faixa.get("max")).intValue());
            }
        }

        byte[] pdf = pipeline.exportarPdf(print);
        try (PDDocument doc = Loader.loadPDF(pdf)) {
            assertThat(doc.getNumberOfPages()).isEqualTo(paginas);
            PDFTextStripper stripper = new PDFTextStripper();
            // Quebras de linha e espaços de justificação variam: compara normalizado.
            String texto = normalizar(stripper.getText(doc));
            for (String t : (List<String>) espera.getOrDefault("textos", List.of())) {
                assertThat(texto).as("texto esperado").contains(normalizar(t));
            }
            for (String t : (List<String>) espera.getOrDefault("ausentes", List.of())) {
                assertThat(texto).as("texto proibido").doesNotContain(normalizar(t));
            }
            for (String t : (List<String>) espera.getOrDefault("emTodasAsPaginas", List.of())) {
                for (int p = 1; p <= paginas; p++) {
                    stripper.setStartPage(p);
                    stripper.setEndPage(p);
                    assertThat(normalizar(stripper.getText(doc))).as("\"" + t + "\" na folha " + p + "/" + paginas)
                            .contains(normalizar(t));
                }
            }
        }

        // Inspeção humana opcional: -Dmatriz.png=<dir> grava a 1ª folha de cada cenário.
        String dirPng = System.getProperty("matriz.png");
        if (dirPng != null) {
            Path destino = Path.of(dirPng).resolve(caso.modelo() + "-" + caso.cenario() + ".png");
            Files.createDirectories(destino.getParent());
            Files.write(destino, pipeline.exportarPng(print, 0));
        }

        List<Map<String, Object>> codigos = (List<Map<String, Object>>) espera.getOrDefault("codigos", List.of());
        if (!codigos.isEmpty()) {
            Set<String> lidos = lerCodigos(print);
            for (Map<String, Object> c : codigos) {
                assertThat(lidos).as("códigos lidos do PNG").contains(c.get("formato") + ":" + c.get("valor"));
            }
        }
    }

    private static String normalizar(String texto) {
        return texto.replaceAll("\\s+", " ").trim();
    }

    /** Todos os códigos legíveis na 1ª folha, como "FORMATO:valor". */
    private Set<String> lerCodigos(JasperPrint print) throws Exception {
        BufferedImage imagem = (BufferedImage) JasperPrintManager.getInstance(contexto.contexto())
                .printToImage(print, 0, ZOOM_LEITURA);
        Map<DecodeHintType, Object> dicas = new EnumMap<>(DecodeHintType.class);
        dicas.put(DecodeHintType.TRY_HARDER, Boolean.TRUE);
        dicas.put(DecodeHintType.POSSIBLE_FORMATS,
                List.of(BarcodeFormat.QR_CODE, BarcodeFormat.CODE_128, BarcodeFormat.ITF, BarcodeFormat.EAN_13));
        BinaryBitmap bitmap = new BinaryBitmap(new HybridBinarizer(new BufferedImageLuminanceSource(imagem)));
        Set<String> lidos = new HashSet<>();
        try {
            for (Result r : new GenericMultipleBarcodeReader(new MultiFormatReader()).decodeMultiple(bitmap, dicas)) {
                lidos.add(r.getBarcodeFormat() + ":" + r.getText());
            }
        } catch (NotFoundException e) {
            // nenhum código legível — a asserção do chamador acusa
        }
        return lidos;
    }

    /** Lista legível dos casos — ajuda a conferir a matriz no relatório do Surefire. */
    @Test
    @EnabledIf("fixturesDisponiveis")
    void matrizTemCasosDeTodasAsFamilias() {
        List<String> nomes = new ArrayList<>(casos().map(Caso::toString).toList());
        assertThat(nomes).contains("boleto · tipico", "danfe · volume", "listagem_vendas · volume",
                "etiqueta_enderecamento · tipico", "contrato · textos_longos");
    }
}
