package dev.reportlenz.render.pipeline;

import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import net.sf.jasperreports.engine.JRExpression;
import net.sf.jasperreports.engine.JRExpressionChunk;
import net.sf.jasperreports.engine.JRSubreport;
import net.sf.jasperreports.engine.design.JasperDesign;
import net.sf.jasperreports.engine.util.JRElementsVisitor;
import net.sf.jasperreports.engine.util.JRVisitorSupport;

/**
 * Referência de subreport ao registro (ADR-020): a expressão é o LITERAL
 * `"repo:<codename>"` (versão publicada atual) ou `"repo:<codename>@<n>"`
 * (versão fixa). Espelha `lerReferenciaDeSubreport` do jrxml-core.
 */
public record ReferenciaDeSubreport(String codename, Integer versao) {

    public static final String ESQUEMA = "repo:";

    private static final Pattern LITERAL = Pattern.compile("^\\s*\"repo:([A-Za-z0-9_.-]+)(?:@([1-9][0-9]*))?\"\\s*$");
    private static final Pattern LOCALIZACAO = Pattern.compile("^repo:([A-Za-z0-9_.-]+)(?:@([1-9][0-9]*))?$");

    /** Lê o literal da expressão do subreport; null se não for `"repo:..."`. */
    public static ReferenciaDeSubreport daExpressao(JRExpression expressao) {
        if (expressao == null || expressao.getChunks() == null || expressao.getChunks().length != 1
                || expressao.getChunks()[0].getType() != JRExpressionChunk.TYPE_TEXT) {
            return null;
        }
        return de(LITERAL.matcher(expressao.getChunks()[0].getText()));
    }

    /** Lê a localização avaliada em runtime (`repo:x@2`, sem aspas); null se não casar. */
    public static ReferenciaDeSubreport daLocalizacao(String uri) {
        return uri == null ? null : de(LOCALIZACAO.matcher(uri.strip()));
    }

    private static ReferenciaDeSubreport de(Matcher m) {
        if (!m.matches()) {
            return null;
        }
        return new ReferenciaDeSubreport(m.group(1), m.group(2) == null ? null : Integer.valueOf(m.group(2)));
    }

    /** Subreports do design (qualquer profundidade alcançada pelo visitor do JR). */
    public static List<JRSubreport> subreports(JasperDesign design) {
        List<JRSubreport> encontrados = new ArrayList<>();
        JRElementsVisitor.visitReport(design, new JRVisitorSupport() {
            @Override
            public void visitSubreport(JRSubreport subreport) {
                encontrados.add(subreport);
            }
        });
        return encontrados;
    }

    @Override
    public String toString() {
        return versao == null ? codename : codename + "@" + versao;
    }
}
