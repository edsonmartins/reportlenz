package dev.reportlenz.render.publish;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.networknt.schema.SchemaRegistry;
import com.networknt.schema.SpecificationVersion;

import dev.reportlenz.render.pipeline.CompiladorJrxml;
import dev.reportlenz.render.pipeline.ErroDeRender.JrxmlInvalido;
import dev.reportlenz.render.pipeline.ErroDeRender.PullProibido;
import tools.jackson.databind.json.JsonMapper;

/**
 * Verificação autoritativa dos gates de publish (RFC-006 §3, ADR-013):
 * G1 = load+compile pela Library 7.0.7 REAL, G2 = anti-Pull do compilador,
 * G5 = inputSchema aceito como JSON Schema 2020-12, G6 = sha256 recalculado.
 * Usada pelo endpoint de verificação (bloco 4) e pelo publish persistente
 * (bloco 5) — nenhuma versão vira `published` sem `verde=true` daqui.
 */
@Component
public class VerificadorDeGates {

    public record Gate(String gate, boolean verde, List<String> erros) {}

    public record Resultado(boolean verde, List<Gate> gates, String jrxmlHash) {}

    private final CompiladorJrxml compilador;
    private final SchemaRegistry registry = SchemaRegistry.withDefaultDialect(SpecificationVersion.DRAFT_2020_12);
    private final JsonMapper json = JsonMapper.builder().build();

    public VerificadorDeGates(CompiladorJrxml compilador) {
        this.compilador = compilador;
    }

    public Resultado verificar(String jrxmlBruto, Map<String, Object> inputSchema, String jrxmlHashInformado) {
        List<Gate> gates = new ArrayList<>();
        String jrxml = jrxmlBruto == null ? "" : jrxmlBruto;

        // G1 (Library é a verdade) e G2 (anti-Pull do compilador).
        List<String> g1 = new ArrayList<>();
        List<String> g2 = new ArrayList<>();
        if (jrxml.isBlank()) {
            g1.add("SCHEMA_INVALID: jrxml vazio");
        } else {
            try {
                compilador.compilar(jrxml);
            } catch (PullProibido e) {
                g2.add(e.getMessage());
            } catch (JrxmlInvalido e) {
                g1.add("SCHEMA_INVALID: " + e.getMessage());
            }
        }
        gates.add(new Gate("G1", g1.isEmpty(), g1));
        gates.add(new Gate("G2", g2.isEmpty(), g2));

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

    public static String sha256(String texto) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(texto.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 indisponível", e);
        }
    }
}
