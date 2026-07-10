package dev.reportlenz.render.api;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.networknt.schema.SchemaRegistry;
import com.networknt.schema.SpecificationVersion;

import dev.reportlenz.render.pipeline.CompiladorJrxml;
import dev.reportlenz.render.pipeline.ErroDeRender.JrxmlInvalido;
import dev.reportlenz.render.pipeline.ErroDeRender.PullProibido;
import tools.jackson.databind.json.JsonMapper;

/**
 * Verificação AUTORITATIVA dos gates de publish (RFC-006 §3, tarefas
 * phase-4/4.1-4.3): o designer avalia G1–G6 em design-time (jrxml-core), mas
 * o veredito final vem daqui — G1 é o load+compile pela Library 7.0.7 REAL
 * (ADR-013), G2 é o gate anti-Pull do compilador, G5 confere que o
 * inputSchema é um JSON Schema 2020-12 válido e G6 recalcula o sha256.
 * G3/G4 são de design-time (modelo/dialeto) e chegam aqui já embutidos no
 * G1 (a Library recusa o que o dialeto não aceita).
 *
 * Publish (bloco 5) SÓ persiste com `verde=true` daqui — "Pass 5 é a única
 * autoridade sobre done" (I-5).
 */
@RestController
public class PublishControlador {

    private final CompiladorJrxml compilador;
    private final SchemaRegistry registry = SchemaRegistry.withDefaultDialect(SpecificationVersion.DRAFT_2020_12);
    private final JsonMapper json = JsonMapper.builder().build();

    public PublishControlador(CompiladorJrxml compilador) {
        this.compilador = compilador;
    }

    public record VerificarRequest(String jrxml, Map<String, Object> inputSchema, String jrxmlHash) {}

    public record Gate(String gate, boolean verde, List<String> erros) {}

    public record VerificarResponse(boolean verde, List<Gate> gates, String jrxmlHash) {}

    @PostMapping("/publish/verificar")
    public VerificarResponse verificar(@RequestBody VerificarRequest request) {
        List<Gate> gates = new ArrayList<>();
        String jrxml = request.jrxml() == null ? "" : request.jrxml();

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
        if (request.inputSchema() == null || request.inputSchema().isEmpty()) {
            g5.add("CONTRACT_MISSING: inputSchema ausente");
        } else {
            try {
                registry.getSchema(json.writeValueAsString(request.inputSchema()));
            } catch (RuntimeException e) {
                g5.add("CONTRACT_MISSING: inputSchema não é um JSON Schema válido — " + e.getMessage());
            }
        }
        gates.add(new Gate("G5", g5.isEmpty(), g5));

        // G6: recalcula o sha256 e compara com o informado pelo designer.
        String hash = sha256(jrxml);
        List<String> g6 = new ArrayList<>();
        if (request.jrxmlHash() != null && !request.jrxmlHash().equalsIgnoreCase(hash)) {
            g6.add("HASH_MISMATCH: jrxml_hash informado não confere com o conteúdo recebido");
        }
        gates.add(new Gate("G6", g6.isEmpty(), g6));

        boolean verde = gates.stream().allMatch(Gate::verde);
        return new VerificarResponse(verde, gates, hash);
    }

    private static String sha256(String texto) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(texto.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 indisponível", e);
        }
    }
}
