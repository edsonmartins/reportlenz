package dev.reportlenz.render.pipeline;

import java.util.List;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import net.sf.jasperreports.engine.DefaultJasperReportsContext;
import net.sf.jasperreports.engine.JRRuntimeException;
import net.sf.jasperreports.engine.JasperReportsContext;
import net.sf.jasperreports.engine.SimpleJasperReportsContext;
import net.sf.jasperreports.repo.DefaultRepositoryService;
import net.sf.jasperreports.repo.RepositoryContext;
import net.sf.jasperreports.repo.RepositoryService;
import net.sf.jasperreports.repo.ReportResource;
import net.sf.jasperreports.repo.Resource;

/**
 * Contexto JasperReports do fill/export (ADR-016 §2, change
 * seguranca-expressoes/1.4): recursos NÃO são carregados por localização
 * arbitrária vinda do payload.
 *
 * A política vive em {@link PoliticaDeRecursos}, o PRIMEIRO serviço de
 * repositório consultado: as propriedades nativas do JR
 * (`default.file.repository.enabled`, `repository.url.filter.enabled`) só
 * cobrem URLs `file:`/http — um caminho absoluto simples (`/etc/hosts`) ainda
 * seria lido (verificado no RecursosRestritosTest). Por isso:
 *
 * - subreport: só `repo:<codename>[@n]` do registro de templates (ADR-020);
 *   arquivo/URL/classpath (`.jasper` = desserialização Java) → recusado;
 * - URL só http(s) com prefixo em `reportlenz.recursos.urls-permitidas`;
 * - caminho sem esquema só se for recurso do ENGINE no classpath
 *   (`net/sf/jasperreports/…`, ex.: fontes DejaVu), sem `..`;
 * - todo o resto → `RECURSO_RECUSADO`.
 */
public class ContextoJasperRestrito {

    private static final Logger log = LoggerFactory.getLogger(ContextoJasperRestrito.class);

    private final SimpleJasperReportsContext contexto;

    /** Sem resolução de subreport (`repo:` recusado) — testes e uso fora do Spring. */
    public ContextoJasperRestrito(List<String> urlsPermitidas) {
        this(urlsPermitidas, (java.util.function.Function<String, net.sf.jasperreports.engine.JasperReport>) null);
    }

    /**
     * @param subreports resolve `repo:<codename>[@n]` em JasperReport (ADR-020);
     *                   null = subreport sempre recusado
     */
    public ContextoJasperRestrito(List<String> urlsPermitidas,
            java.util.function.Function<String, net.sf.jasperreports.engine.JasperReport> subreports) {
        List<String> prefixos = urlsPermitidas.stream()
                .filter(p -> p != null && !p.isBlank()).map(String::strip).toList();
        this.contexto = new SimpleJasperReportsContext(DefaultJasperReportsContext.getInstance());
        // Ordem importa: a política decide ANTES do default tentar resolver.
        contexto.setExtensions(RepositoryService.class,
                List.of(new PoliticaDeRecursos(prefixos, subreports), new DefaultRepositoryService(contexto)));
        log.info("[RECURSOS] contexto restrito: arquivos=off, subreport por localização=off, prefixos de URL={}",
                prefixos.size());
    }

    /** Contexto sem nenhuma URL externa — testes e uso fora do Spring. */
    public static ContextoJasperRestrito semUrls() {
        return new ContextoJasperRestrito(List.of());
    }

    public JasperReportsContext contexto() {
        return contexto;
    }

    /** Política de localização: devolve null (segue ao default) só para o que é permitido. */
    static final class PoliticaDeRecursos implements RepositoryService {

        private static final Pattern ESQUEMA = Pattern.compile("^[A-Za-z][A-Za-z0-9+.-]*:");
        private static final String CLASSPATH_DO_ENGINE = "net/sf/jasperreports/";

        private final List<String> prefixos;
        private final java.util.function.Function<String, net.sf.jasperreports.engine.JasperReport> subreports;

        PoliticaDeRecursos(List<String> prefixos,
                java.util.function.Function<String, net.sf.jasperreports.engine.JasperReport> subreports) {
            this.prefixos = List.copyOf(prefixos);
            this.subreports = subreports;
        }

        @Override
        public Resource getResource(String uri) {
            return getResource(null, uri, Resource.class);
        }

        @Override
        public void saveResource(String uri, Resource resource) {
            throw new UnsupportedOperationException("repositório somente leitura");
        }

        @Override
        public <K extends Resource> K getResource(String uri, Class<K> resourceType) {
            return getResource(null, uri, resourceType);
        }

        @Override
        public <K extends Resource> K getResource(RepositoryContext context, String uri, Class<K> resourceType) {
            if (resourceType != null && ReportResource.class.isAssignableFrom(resourceType)) {
                // ADR-020: o ÚNICO subreport aceito é o template publicado do registro.
                if (subreports != null && resourceType.isAssignableFrom(ReportResource.class)
                        && ReferenciaDeSubreport.daLocalizacao(uri) != null) {
                    ReportResource recurso = new ReportResource();
                    recurso.setValue(subreports.apply(uri.strip()));
                    return resourceType.cast(recurso);
                }
                throw recusa("subreport só por template publicado (\"repo:<codename>\", ADR-020)", uri);
            }
            if (uri == null || uri.isBlank()) {
                throw recusa("localização vazia", uri);
            }
            String local = uri.strip();
            if (ESQUEMA.matcher(local).find()) {
                String minusculo = local.toLowerCase(java.util.Locale.ROOT);
                boolean http = minusculo.startsWith("http://") || minusculo.startsWith("https://");
                if (http && prefixos.stream().anyMatch(local::startsWith)) {
                    return null;
                }
                throw recusa("URL fora dos prefixos permitidos (REPORTLENZ_RECURSOS_URLS_PERMITIDAS)", uri);
            }
            if (local.startsWith(CLASSPATH_DO_ENGINE) && !local.contains("..") && !local.contains("\\")) {
                return null;
            }
            throw recusa("caminho local não é permitido", uri);
        }

        private static JRRuntimeException recusa(String motivo, String uri) {
            String resumo = uri == null ? "" : (uri.length() > 80 ? uri.substring(0, 77) + "..." : uri);
            return new JRRuntimeException("RECURSO_RECUSADO: " + motivo + " (ADR-016): " + resumo);
        }
    }
}
