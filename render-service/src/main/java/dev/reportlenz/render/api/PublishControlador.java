package dev.reportlenz.render.api;

import java.util.List;
import java.util.Map;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import dev.reportlenz.render.publish.VerificadorDeGates;

/**
 * Verificação AUTORITATIVA dos gates de publish (RFC-006 §3, tarefas
 * phase-4/4.1-4.3): o designer avalia G1–G6 em design-time (jrxml-core), mas
 * o veredito final vem do {@link VerificadorDeGates} — G1 é o load+compile
 * pela Library 7.0.7 REAL (ADR-013). G3/G4 são de design-time (modelo/
 * dialeto) e chegam aqui embutidos no G1 (a Library recusa o que o dialeto
 * não aceita).
 *
 * O publish persistente (bloco 5, TemplatesControlador) usa o MESMO
 * verificador — "Pass 5 é a única autoridade sobre done" (I-5).
 */
@RestController
public class PublishControlador {

    private final VerificadorDeGates verificador;

    public PublishControlador(VerificadorDeGates verificador) {
        this.verificador = verificador;
    }

    public record VerificarRequest(String jrxml, Map<String, Object> inputSchema, String jrxmlHash) {}

    public record Gate(String gate, boolean verde, List<String> erros) {}

    public record VerificarResponse(boolean verde, List<Gate> gates, String jrxmlHash) {}

    @PostMapping("/publish/verificar")
    public VerificarResponse verificar(@RequestBody VerificarRequest request) {
        var r = verificador.verificar(request.jrxml(), request.inputSchema(), request.jrxmlHash());
        return new VerificarResponse(
                r.verde(),
                r.gates().stream().map(g -> new Gate(g.gate(), g.verde(), g.erros())).toList(),
                r.jrxmlHash());
    }
}
