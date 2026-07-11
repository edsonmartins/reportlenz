package dev.reportlenz.render.api;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import dev.reportlenz.render.publish.RepositorioDeTemplates;
import dev.reportlenz.render.publish.RepositorioDeTemplates.Versao;
import dev.reportlenz.render.publish.VerificadorDeGates;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/**
 * Ciclo de vida do template (ADR-009 / RFC-006 §2, tarefas phase-4/5.1-5.3):
 * draft→published→deprecated com published IMUTÁVEL e auditoria LGPD.
 *
 * Gates: a "validação dupla no SAVE" (ADR-009 regra 2) recusa no draft o que
 * a Library não carrega (G1) e qualquer Pull (G2); o PUBLISH exige TODOS os
 * gates do VerificadorDeGates verdes (RFC-006 §3 — 422 com o checklist).
 */
@RestController
public class TemplatesControlador {

    private final RepositorioDeTemplates repositorio;
    private final VerificadorDeGates verificador;
    private final JsonMapper json = JsonMapper.builder().build();

    public TemplatesControlador(RepositorioDeTemplates repositorio, VerificadorDeGates verificador) {
        this.repositorio = repositorio;
        this.verificador = verificador;
    }

    public record SalvarRequest(String jrxml, Map<String, Object> inputSchema, String actor) {}

    public record SalvarResponse(String versionId, int version, boolean novaVersao, String jrxmlHash) {}

    @PostMapping("/templates/{codename}/versoes")
    public ResponseEntity<?> salvar(@PathVariable String codename, @RequestBody SalvarRequest request) {
        // Validação dupla no save (ADR-009 regra 2): G1 (Library) e G2 (anti-Pull).
        var gates = verificador.verificar(request.jrxml(), request.inputSchema(), null);
        var reprovadosNoSave = gates.gates().stream()
                .filter(g -> ("G1".equals(g.gate()) || "G2".equals(g.gate())) && !g.verde())
                .toList();
        if (!reprovadosNoSave.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "codigo", "SAVE_REPROVADO",
                    "mensagem", "o draft não passa nos gates de save (G1/G2)",
                    "gates", reprovadosNoSave));
        }
        var salva = repositorio.salvarDraft(
                codename,
                request.jrxml(),
                request.inputSchema() == null ? "{}" : json.writeValueAsString(request.inputSchema()),
                gates.jrxmlHash(),
                request.actor());
        return ResponseEntity.ok(new SalvarResponse(salva.versionId(), salva.version(), salva.novaVersao(), gates.jrxmlHash()));
    }

    public record AcaoRequest(String actor) {}

    @PostMapping("/templates/{codename}/versoes/{version}/publicar")
    public ResponseEntity<?> publicar(@PathVariable String codename, @PathVariable int version,
            @RequestBody(required = false) AcaoRequest request) {
        Versao versao = repositorio.consultar(codename, version).orElse(null);
        if (versao == null) {
            return naoEncontrada(codename, version);
        }
        // Publish só com TODOS os gates verdes (RFC-006 §3 / I-5).
        var gates = verificador.verificar(versao.jrxml(), lerSchema(versao.inputSchemaJson()), versao.jrxmlHash());
        if (!gates.verde()) {
            return ResponseEntity.unprocessableEntity().body(Map.of(
                    "codigo", "PUBLISH_BLOQUEADO",
                    "mensagem", "gates de governança reprovaram — publish bloqueado",
                    "gates", gates.gates()));
        }
        repositorio.publicar(versao, request == null ? null : request.actor());
        return ResponseEntity.ok(Map.of("status", "published", "version", version));
    }

    @PostMapping("/templates/{codename}/versoes/{version}/deprecar")
    public ResponseEntity<?> deprecar(@PathVariable String codename, @PathVariable int version,
            @RequestBody(required = false) AcaoRequest request) {
        Versao versao = repositorio.consultar(codename, version).orElse(null);
        if (versao == null) {
            return naoEncontrada(codename, version);
        }
        repositorio.deprecar(versao, request == null ? null : request.actor());
        return ResponseEntity.ok(Map.of("status", "deprecated", "version", version));
    }

    public record VersaoResumo(int version, String status, String jrxmlHash, String criadoEm, String criadoPor) {}

    @GetMapping("/templates/{codename}")
    public ResponseEntity<?> listar(@PathVariable String codename) {
        List<Versao> versoes = repositorio.listar(codename);
        if (versoes.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new TratadorDeErros.ErroResponse("TEMPLATE_INEXISTENTE", codename));
        }
        return ResponseEntity.ok(versoes.stream()
                .map(v -> new VersaoResumo(v.version(), v.status(), v.jrxmlHash(), v.criadoEm(), v.criadoPor()))
                .toList());
    }

    @GetMapping("/templates/{codename}/versoes/{version}")
    public ResponseEntity<?> detalhe(@PathVariable String codename, @PathVariable int version) {
        return repositorio.consultar(codename, version)
                .<ResponseEntity<?>>map(v -> ResponseEntity.ok(Map.of(
                        "codename", v.codename(),
                        "version", v.version(),
                        "status", v.status(),
                        "jrxml", v.jrxml(),
                        "inputSchema", lerSchema(v.inputSchemaJson()),
                        "jrxmlHash", v.jrxmlHash())))
                .orElseGet(() -> naoEncontrada(codename, version));
    }

    private ResponseEntity<TratadorDeErros.ErroResponse> naoEncontrada(String codename, int version) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(new TratadorDeErros.ErroResponse("VERSAO_INEXISTENTE", codename + " v" + version));
    }

    private Map<String, Object> lerSchema(String schemaJson) {
        return json.readValue(schemaJson == null || schemaJson.isBlank() ? "{}" : schemaJson,
                new TypeReference<Map<String, Object>>() {});
    }
}
