package dev.reportlenz.render.pipeline;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.net.InetSocketAddress;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import javax.imageio.ImageIO;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import com.sun.net.httpserver.HttpServer;

import io.micrometer.observation.ObservationRegistry;
import net.sf.jasperreports.engine.JREmptyDataSource;
import net.sf.jasperreports.engine.JasperFillManager;
import net.sf.jasperreports.engine.JasperReport;

/**
 * Contexto Jasper restrito (ADR-016 §2, change seguranca-expressoes/1.4):
 * cenários "Subreport apontando para arquivo", "Imagem apontando para arquivo
 * local ou URL interna" e "Fontes do engine continuam disponíveis". Cada
 * recusa tem um CONTROLE no contexto default do engine, provando que o
 * recurso seria de fato carregado sem a restrição.
 */
class RecursosRestritosTest {

    @TempDir
    Path tmp;

    private HttpServer servidor;
    private String urlDaImagem;
    private Path imagemLocal;

    private final CompiladorJrxml compilador = new CompiladorJrxml();

    private static final String JRXML_IMAGEM = """
            <?xml version="1.0" encoding="UTF-8"?>
            <jasperReport name="img" pageWidth="595" pageHeight="842" columnWidth="555" \
            leftMargin="20" rightMargin="20" topMargin="30" bottomMargin="30">
            \t<parameter name="img" class="java.lang.String"/>
            \t<title height="60">
            \t\t<element kind="image" x="0" y="0" width="50" height="50" onErrorType="Error">
            \t\t\t<expression><![CDATA[$P{img}]]></expression>
            \t\t</element>
            \t</title>
            </jasperReport>
            """;

    private static final String JRXML_SUB_MESTRE = """
            <?xml version="1.0" encoding="UTF-8"?>
            <jasperReport name="mestre" pageWidth="595" pageHeight="842" columnWidth="555" \
            leftMargin="20" rightMargin="20" topMargin="30" bottomMargin="30">
            \t<parameter name="sub_template" class="java.lang.String"/>
            \t<title height="60">
            \t\t<element kind="subreport" x="0" y="0" width="555" height="30">
            \t\t\t<expression><![CDATA[$P{sub_template}]]></expression>
            \t\t</element>
            \t</title>
            </jasperReport>
            """;

    private static final String JRXML_SUB_FILHO = """
            <?xml version="1.0" encoding="UTF-8"?>
            <jasperReport name="filho" pageWidth="555" pageHeight="842" columnWidth="555" \
            leftMargin="0" rightMargin="0" topMargin="0" bottomMargin="0" whenNoDataType="AllSectionsNoDetail">
            \t<title height="20">
            \t\t<element kind="staticText" x="0" y="0" width="200" height="20">
            \t\t\t<text><![CDATA[SUBREPORT-CARREGADO]]></text>
            \t\t</element>
            \t</title>
            </jasperReport>
            """;

    @BeforeEach
    void preparar() throws Exception {
        BufferedImage img = new BufferedImage(4, 4, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream png = new ByteArrayOutputStream();
        ImageIO.write(img, "png", png);
        imagemLocal = tmp.resolve("logo.png");
        Files.write(imagemLocal, png.toByteArray());

        byte[] bytes = png.toByteArray();
        servidor = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        servidor.createContext("/", troca -> {
            troca.getResponseHeaders().add("Content-Type", "image/png");
            troca.sendResponseHeaders(200, bytes.length);
            troca.getResponseBody().write(bytes);
            troca.close();
        });
        servidor.start();
        urlDaImagem = "http://127.0.0.1:" + servidor.getAddress().getPort() + "/logo.png";
    }

    @AfterEach
    void encerrar() {
        servidor.stop(0);
    }

    private PipelineDeRender pipeline(ContextoJasperRestrito contexto) {
        return new PipelineDeRender(compilador, new CacheDeCompilacaoEmMemoria(), ObservationRegistry.NOOP, contexto);
    }

    private static Map<String, Object> payload(String chave, Object valor) {
        Map<String, Object> m = new HashMap<>();
        m.put(chave, valor);
        return m;
    }

    /**
     * Controle: o engine SEM as restrições do produto (compile direto, contexto
     * default) carrega o recurso — prova que a recusa é do ReportLenz.
     */
    private void controleCarregaNoContextoDefault(String jrxml, Map<String, Object> parametros) throws Exception {
        JasperReport report = net.sf.jasperreports.engine.JasperCompileManager.compileReport(
                new java.io.ByteArrayInputStream(jrxml.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        assertThat(JasperFillManager.fillReport(report, parametros, new JREmptyDataSource(1))).isNotNull();
    }

    @Test
    void imagemDeArquivoLocalERecusada() throws Exception {
        controleCarregaNoContextoDefault(JRXML_IMAGEM, payload("img", imagemLocal.toString()));
        assertThatThrownBy(() -> pipeline(ContextoJasperRestrito.semUrls())
                .renderizarPdf(JRXML_IMAGEM, payload("img", imagemLocal.toString())))
                .isInstanceOf(ErroDeRender.FalhaDeRender.class);
        assertThatThrownBy(() -> pipeline(ContextoJasperRestrito.semUrls())
                .renderizarPdf(JRXML_IMAGEM, payload("img", imagemLocal.toUri().toString())))
                .isInstanceOf(ErroDeRender.FalhaDeRender.class);
    }

    @Test
    void imagemDeUrlForaDaListaERecusadaEDentroDelaCarrega() throws Exception {
        controleCarregaNoContextoDefault(JRXML_IMAGEM, payload("img", urlDaImagem));
        // URL interna (SSRF) sem prefixo permitido → não é buscada.
        assertThatThrownBy(() -> pipeline(ContextoJasperRestrito.semUrls())
                .renderizarPdf(JRXML_IMAGEM, payload("img", urlDaImagem)))
                .isInstanceOf(ErroDeRender.FalhaDeRender.class);
        // Prefixo de OUTRO host não libera este.
        assertThatThrownBy(() -> pipeline(new ContextoJasperRestrito(List.of("https://cdn.cliente.com.br/")))
                .renderizarPdf(JRXML_IMAGEM, payload("img", urlDaImagem)))
                .isInstanceOf(ErroDeRender.FalhaDeRender.class);
        // Com o prefixo configurado, a imagem carrega.
        String prefixo = urlDaImagem.substring(0, urlDaImagem.lastIndexOf('/') + 1);
        byte[] pdf = pipeline(new ContextoJasperRestrito(List.of(prefixo)))
                .renderizarPdf(JRXML_IMAGEM, payload("img", urlDaImagem));
        assertThat(new String(pdf, 0, 5)).isEqualTo("%PDF-");
    }

    @Test
    void subreportPorLocalizacaoERecusado() throws Exception {
        // O engine carrega subreport por localização como .jasper SERIALIZADO
        // (desserialização Java de um arquivo apontado pelo payload).
        Path fonte = tmp.resolve("filho.jrxml");
        Files.writeString(fonte, JRXML_SUB_FILHO);
        Path filho = tmp.resolve("filho.jasper");
        net.sf.jasperreports.engine.JasperCompileManager.compileReportToFile(fonte.toString(), filho.toString());
        controleCarregaNoContextoDefault(JRXML_SUB_MESTRE, payload("sub_template", filho.toString()));

        // Desde o ADR-020 o G7 já recusa no COMPILE (subreport fora do literal "repo:").
        assertThatThrownBy(() -> pipeline(ContextoJasperRestrito.semUrls())
                .renderizarPdf(JRXML_SUB_MESTRE, payload("sub_template", filho.toString())))
                .isInstanceOf(ErroDeRender.ExpressaoProibida.class)
                .hasMessageContaining("repo:");

        // E mesmo com o literal "repo:", sem resolvedor do registro o fill recusa.
        String comRepo = JRXML_SUB_MESTRE.replace("$P{sub_template}", "\"repo:qualquer\"");
        assertThatThrownBy(() -> pipeline(ContextoJasperRestrito.semUrls()).renderizarPdf(comRepo, Map.of()))
                .isInstanceOf(ErroDeRender.FalhaDeRender.class)
                .hasMessageContaining("RECURSO_RECUSADO");
    }

    @Test
    void fontesDoEngineContinuamDisponiveis() throws Exception {
        String jrxml = """
                <?xml version="1.0" encoding="UTF-8"?>
                <jasperReport name="acentos" pageWidth="595" pageHeight="842" columnWidth="555" \
                leftMargin="20" rightMargin="20" topMargin="30" bottomMargin="30">
                \t<title height="30">
                \t\t<element kind="staticText" x="0" y="0" width="555" height="20">
                \t\t\t<text><![CDATA[Preço R$ 10,00 — ação, coração]]></text>
                \t\t</element>
                \t</title>
                </jasperReport>
                """;
        byte[] pdf = pipeline(ContextoJasperRestrito.semUrls()).renderizarPdf(jrxml, Map.of());
        try (PDDocument doc = Loader.loadPDF(pdf)) {
            assertThat(new PDFTextStripper().getText(doc)).contains("Preço R$ 10,00", "ação", "coração");
            assertThat(doc.getPage(0).getResources().getFontNames()).isNotEmpty();
            var fonte = doc.getPage(0).getResources().getFont(doc.getPage(0).getResources().getFontNames().iterator().next());
            assertThat(fonte.getName()).contains("DejaVu");
            assertThat(fonte.isEmbedded()).isTrue();
        }
    }
}
