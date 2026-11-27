package dev.reportlenz.render.motor;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import dev.reportlenz.render.pipeline.CacheDeCompilacao;
import dev.reportlenz.render.pipeline.CacheDeCompilacaoEmMemoria;
import dev.reportlenz.render.pipeline.CompiladorJrxml;
import dev.reportlenz.render.pipeline.ContextoJasperRestrito;
import dev.reportlenz.render.pipeline.ErroDeRender;
import dev.reportlenz.render.pipeline.FonteDeSubreports;
import dev.reportlenz.render.pipeline.PipelineDeRender;
import dev.reportlenz.render.pipeline.ReferenciaDeSubreport;
import dev.reportlenz.render.pipeline.ValidadorDePayload;
import dev.reportlenz.render.publish.VerificadorDeGates;
import io.micrometer.observation.ObservationRegistry;
import net.sf.jasperreports.engine.JasperPrint;
import net.sf.jasperreports.engine.JasperReport;

/**
 * Fachada pública do núcleo ReportLenz (ADR-026 §2) — Java puro, sem Spring.
 *
 * <pre>{@code
 * MotorReportLenz motor = MotorReportLenz.builder()
 *     .urlsPermitidas(List.of("https://cdn.empresa.com.br/"))
 *     .subreports(ref -> registro.jrxmlPublicado(ref))
 *     .build();
 * byte[] pdf = motor.renderizarPdf(jrxml, payload);
 * }</pre>
 *
 * <p>As barreiras de segurança NÃO são configuráveis: todo JRXML passa pelo
 * anti-Pull e pelo G7 (allowlist de expressões, ADR-016) antes de compilar, e
 * o fill roda no contexto restrito (sem arquivos locais, sem URL fora da
 * lista, subreport só por {@code "repo:<codename>"}) com o filtro de classes
 * do engine (ADR-021). Payload JSON (números como Double, datas como String)
 * é convertido para as classes declaradas; locale pt-BR.
 *
 * <p>Thread-safe: uma instância por aplicação (o cache de compilação é
 * compartilhado entre as chamadas).
 */
public final class MotorReportLenz {

    private final CompiladorJrxml compilador;
    private final CacheDeCompilacao cache;
    private final PipelineDeRender pipeline;
    private final ValidadorDePayload validador;
    private final VerificadorDeGates gates;

    private MotorReportLenz(Construtor c) {
        this.compilador = new CompiladorJrxml();
        this.cache = c.cache != null ? c.cache : new CacheDeCompilacaoEmMemoria();
        FonteDeSubreports fonte = c.subreports;
        ContextoJasperRestrito contexto = new ContextoJasperRestrito(c.urlsPermitidas,
                fonte == null ? null : uri -> compilarSubreport(fonte, uri));
        this.pipeline = new PipelineDeRender(compilador, cache, c.observacoes, contexto);
        this.validador = new ValidadorDePayload();
        this.gates = new VerificadorDeGates(compilador, fonte);
    }

    public static Construtor builder() {
        return new Construtor();
    }

    /** Subreport {@code "repo:<codename>[@n]"} → JRXML da fonte → compilado (com G7 e cache). */
    private JasperReport compilarSubreport(FonteDeSubreports fonte, String uri) {
        ReferenciaDeSubreport ref = ReferenciaDeSubreport.daLocalizacao(uri);
        String jrxml = fonte.jrxml(ref).orElseThrow(() ->
                new ErroDeRender.FalhaDeRender("SUBREPORT_INDISPONIVEL: " + ref + " não encontrado na fonte de subreports", null));
        return cache.obterOuCompilar(jrxml, compilador::compilar);
    }

    /** Compila com anti-Pull + G7 (lança {@link ErroDeRender.PullProibido}/{@link ErroDeRender.ExpressaoProibida}). */
    public JasperReport compilar(String jrxml) {
        return cache.obterOuCompilar(jrxml, compilador::compilar);
    }

    /** Preenche — para quem quer exportar em outro formato com a própria API do JasperReports. */
    public JasperPrint preencher(String jrxml, Map<String, Object> payload) {
        return pipeline.preencher(jrxml, payload);
    }

    public byte[] renderizarPdf(String jrxml, Map<String, Object> payload) {
        return pipeline.exportarPdf(preencher(jrxml, payload));
    }

    /** Uma página como PNG (2×, 144 dpi — o mesmo do preview do designer). */
    public byte[] renderizarPng(String jrxml, Map<String, Object> payload, int pagina) {
        return pipeline.exportarPng(preencher(jrxml, payload), pagina);
    }

    /** Todas as páginas como PNG. */
    public List<byte[]> renderizarPngs(String jrxml, Map<String, Object> payload) {
        JasperPrint print = preencher(jrxml, payload);
        List<byte[]> paginas = new ArrayList<>(print.getPages().size());
        for (int i = 0; i < print.getPages().size(); i++) {
            paginas.add(pipeline.exportarPng(print, i));
        }
        return paginas;
    }

    /**
     * Valida o payload contra o inputSchema do template (RFC-002).
     *
     * @throws ErroDeRender.PayloadForaDoContrato com a lista de violações
     */
    public void validarPayload(Map<String, Object> inputSchema, Map<String, Object> payload) {
        validador.validar(inputSchema, payload);
    }

    /**
     * Gates do serviço: G1 (Library), G2 (anti-Pull), G7 (expressões) e G8
     * (subreports resolvíveis e sem ciclo — exige {@link Construtor#subreports}).
     *
     * @param codename o template verificado (detecta ciclo de volta a ele); pode ser null
     */
    public VerificadorDeGates.Resultado verificarGates(String jrxml, Map<String, Object> inputSchema, String codename) {
        return gates.verificar(jrxml, inputSchema, null, codename);
    }

    public static final class Construtor {
        private List<String> urlsPermitidas = List.of();
        private FonteDeSubreports subreports;
        private CacheDeCompilacao cache;
        private ObservationRegistry observacoes = ObservationRegistry.NOOP;

        private Construtor() {}

        /** Prefixos de URL de onde imagens podem ser buscadas (ADR-016). Default: nenhum. */
        public Construtor urlsPermitidas(List<String> prefixos) {
            this.urlsPermitidas = List.copyOf(Objects.requireNonNull(prefixos));
            return this;
        }

        /** Fonte dos JRXML referenciados por {@code "repo:<codename>[@n]"} (ADR-020). Default: subreport recusado. */
        public Construtor subreports(FonteDeSubreports fonte) {
            this.subreports = fonte;
            return this;
        }

        /** Cache de compilação (chave = sha256 do JRXML). Default: memória, LRU. */
        public Construtor cache(CacheDeCompilacao cache) {
            this.cache = cache;
            return this;
        }

        /** Observações (Micrometer) por etapa: render.compilacao / render.fill. Default: NOOP. */
        public Construtor observacoes(ObservationRegistry registro) {
            this.observacoes = Objects.requireNonNull(registro);
            return this;
        }

        public MotorReportLenz build() {
            return new MotorReportLenz(this);
        }
    }
}
