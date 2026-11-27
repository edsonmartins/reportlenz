package dev.reportlenz.render.publish;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;


import com.networknt.schema.SchemaRegistry;
import com.networknt.schema.SpecificationVersion;

import dev.reportlenz.render.pipeline.CompiladorJrxml;
import dev.reportlenz.render.pipeline.ErroDeRender.ExpressaoProibida;
import dev.reportlenz.render.pipeline.ErroDeRender.JrxmlInvalido;
import dev.reportlenz.render.pipeline.ErroDeRender.PullProibido;
import tools.jackson.databind.json.JsonMapper;

/**
 * Verificação autoritativa dos gates de publish (RFC-006 §3, ADR-013):
 * G1 = load+compile pela Library 7.0.7 REAL, G2 = anti-Pull do compilador,
 * G7 = segurança de expressão (ADR-016), G5 = inputSchema aceito como JSON Schema 2020-12, G6 = sha256 recalculado.
 * Usada pelo endpoint de verificação (bloco 4) e pelo publish persistente
 * (bloco 5) — nenhuma versão vira `published` sem `verde=true` daqui.
 */
public class VerificadorDeGates {

    public record Gate(String gate, boolean verde, List<String> erros) {}

    public record Resultado(boolean verde, List<Gate> gates, String jrxmlHash) {}

    private final CompiladorJrxml compilador;
    /** ADR-020: templates referenciados por subreport (null = G8 sem consulta ao registro). */
    private final dev.reportlenz.render.pipeline.FonteDeSubreports subreports;
    private final SchemaRegistry registry = SchemaRegistry.withDefaultDialect(SpecificationVersion.DRAFT_2020_12);
    private final JsonMapper json = JsonMapper.builder().build();

    public VerificadorDeGates(CompiladorJrxml compilador) {
        this(compilador, null);
    }

    public VerificadorDeGates(CompiladorJrxml compilador, dev.reportlenz.render.pipeline.FonteDeSubreports subreports) {
        this.compilador = compilador;
        this.subreports = subreports;
    }

    public Resultado verificar(String jrxmlBruto, Map<String, Object> inputSchema, String jrxmlHashInformado) {
        return verificar(jrxmlBruto, inputSchema, jrxmlHashInformado, null);
    }

    /**
     * @param codename template sendo verificado/publicado — permite ao G8 detectar
     *                 ciclo de subreports de volta a ele (ADR-020); null = só resolvibilidade
     */
    public Resultado verificar(String jrxmlBruto, Map<String, Object> inputSchema, String jrxmlHashInformado,
            String codename) {
        List<Gate> gates = new ArrayList<>();
        String jrxml = jrxmlBruto == null ? "" : jrxmlBruto;

        // G1 (Library é a verdade) e G2 (anti-Pull do compilador).
        List<String> g1 = new ArrayList<>();
        List<String> g2 = new ArrayList<>();
        List<String> g7 = new ArrayList<>();
        if (jrxml.isBlank()) {
            g1.add("SCHEMA_INVALID: jrxml vazio");
        } else {
            try {
                compilador.compilar(jrxml);
            } catch (PullProibido e) {
                g2.add(e.getMessage());
            } catch (ExpressaoProibida e) {
                g7.addAll(e.violacoes());
            } catch (JrxmlInvalido e) {
                g1.add("SCHEMA_INVALID: " + e.getMessage());
            }
        }
        gates.add(new Gate("G1", g1.isEmpty(), g1));
        gates.add(new Gate("G2", g2.isEmpty(), g2));
        // G7 (ADR-016): segurança de expressão — allowlist léxica + estrutura.
        gates.add(new Gate("G7", g7.isEmpty(), g7));

        // G8 (ADR-020): subreports resolvem no registro e o grafo não volta a este template.
        List<String> g8 = new ArrayList<>();
        if (g1.isEmpty() && g2.isEmpty() && g7.isEmpty() && !jrxml.isBlank()) {
            verificarSubreports(jrxml, codename, new java.util.ArrayDeque<>(), new java.util.HashSet<>(), g8);
        }
        gates.add(new Gate("G8", g8.isEmpty(), g8));

        // G5: inputSchema presente e aceito como JSON Schema 2020-12.
        List<String> g5 = new ArrayList<>();
        if (inputSchema == null || inputSchema.isEmpty()) {
            g5.add("CONTRACT_MISSING: inputSchema ausente");
        } else {
            try {
                registry.getSchema(json.writeValueAsString(inputSchema));
            } catch (RuntimeException e) {
                g5.add("CONTRACT_MISSING: inputSchema não é um JSON Schema válido — " + e.getMessage());
            }
        }
        gates.add(new Gate("G5", g5.isEmpty(), g5));

        // G6: recalcula o sha256 e compara com o informado pelo designer.
        String hash = sha256(jrxml);
        List<String> g6 = new ArrayList<>();
        if (jrxmlHashInformado != null && !jrxmlHashInformado.equalsIgnoreCase(hash)) {
            g6.add("HASH_MISMATCH: jrxml_hash informado não confere com o conteúdo recebido");
        }
        gates.add(new Gate("G6", g6.isEmpty(), g6));

        boolean verde = gates.stream().allMatch(Gate::verde);
        return new Resultado(verde, gates, hash);
    }

    /** DFS pelas versões referenciadas; `caminho` = cadeia atual para a mensagem de ciclo. */
    private void verificarSubreports(String jrxml, String raiz, java.util.Deque<String> caminho,
            java.util.Set<String> visitados, List<String> erros) {
        net.sf.jasperreports.engine.design.JasperDesign design;
        try {
            design = net.sf.jasperreports.engine.xml.JRXmlLoader.load(
                    new java.io.ByteArrayInputStream(jrxml.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            erros.add("SUBREPORT_INDISPONIVEL: template referenciado não carrega — " + e.getMessage());
            return;
        }
        for (var s : dev.reportlenz.render.pipeline.ReferenciaDeSubreport.subreports(design)) {
            var ref = dev.reportlenz.render.pipeline.ReferenciaDeSubreport.daExpressao(s.getExpression());
            if (ref == null) {
                continue; // forma inválida já é do G7
            }
            String cadeia = (raiz == null ? "" : raiz + " → ") + String.join(" → ", caminho)
                    + (caminho.isEmpty() ? "" : " → ") + ref;
            if (raiz != null && raiz.equals(ref.codename())) {
                erros.add("SUBREPORT_CICLO: " + cadeia);
                continue;
            }
            if (subreports == null) {
                continue;
            }
            var filho = subreports.jrxml(ref);
            if (filho.isEmpty()) {
                erros.add("SUBREPORT_INDISPONIVEL: \"" + ref + "\" não está publicado"
                        + (caminho.isEmpty() ? "" : " (via " + String.join(" → ", caminho) + ")"));
                continue;
            }
            if (visitados.add(ref.toString()) && caminho.size() < 16) {
                caminho.addLast(ref.toString());
                verificarSubreports(filho.get(), raiz, caminho, visitados, erros);
                caminho.removeLast();
            }
        }
    }

    public static String sha256(String texto) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(texto.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 indisponível", e);
        }
    }
}
