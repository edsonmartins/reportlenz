package dev.reportlenz.render.pipeline;

import static java.nio.charset.StandardCharsets.UTF_8;

import java.io.ByteArrayInputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Component;

import dev.reportlenz.render.publish.RepositorioDeTemplates;
import net.sf.jasperreports.engine.JRRuntimeException;
import net.sf.jasperreports.engine.JRSubreport;
import net.sf.jasperreports.engine.JasperReport;
import net.sf.jasperreports.engine.design.JasperDesign;
import net.sf.jasperreports.engine.xml.JRXmlLoader;

/**
 * Subreport por codename publicado (ADR-020): busca o JRXML no registro de
 * templates e compila pelo MESMO caminho do render — cache por sha256
 * (ADR-008) + anti-Pull + G7 (ADR-016). Nada de arquivo/URL/classpath.
 */
@Component
public class ResolvedorDeSubreports implements FonteDeSubreports {

    private final RepositorioDeTemplates repositorio;
    private final CompiladorJrxml compilador;
    private final CacheDeCompilacao cache;

    public ResolvedorDeSubreports(RepositorioDeTemplates repositorio, CompiladorJrxml compilador, CacheDeCompilacao cache) {
        this.repositorio = repositorio;
        this.compilador = compilador;
        this.cache = cache;
    }

    @Override
    public Optional<String> jrxml(ReferenciaDeSubreport ref) {
        if (ref.versao() == null) {
            return repositorio.publicada(ref.codename()).map(RepositorioDeTemplates.Versao::jrxml);
        }
        return repositorio.consultar(ref.codename(), ref.versao())
                .filter(v -> "published".equals(v.status()) || "deprecated".equals(v.status()))
                .map(RepositorioDeTemplates.Versao::jrxml);
    }

    /** Chamado no fill pela PoliticaDeRecursos com a localização avaliada (`repo:x[@n]`). */
    public JasperReport compilar(String localizacao) {
        ReferenciaDeSubreport ref = ReferenciaDeSubreport.daLocalizacao(localizacao);
        if (ref == null) {
            throw new JRRuntimeException("SUBREPORT_INDISPONIVEL: localização inválida (ADR-020): " + localizacao);
        }
        String jrxml = jrxml(ref).orElseThrow(() -> new JRRuntimeException(
                "SUBREPORT_INDISPONIVEL: template \"" + ref + "\" não está publicado (ADR-020)"));
        return cache.obterOuCompilar(jrxml, compilador::compilar);
    }

    /**
     * Referências literais que NÃO resolvem (preview, ADR-020 §5). JRXML que não
     * carrega ou subreport fora do literal ficam para o compile/G7 reportarem.
     */
    public List<String> indisponiveis(String jrxmlMestre) {
        JasperDesign design;
        try {
            design = JRXmlLoader.load(new ByteArrayInputStream(jrxmlMestre.getBytes(UTF_8)));
        } catch (Exception e) {
            return List.of();
        }
        List<String> problemas = new ArrayList<>();
        for (JRSubreport s : ReferenciaDeSubreport.subreports(design)) {
            ReferenciaDeSubreport ref = ReferenciaDeSubreport.daExpressao(s.getExpression());
            if (ref != null && jrxml(ref).isEmpty()) {
                problemas.add("template \"" + ref + "\" não está publicado");
            }
        }
        return problemas;
    }
}
