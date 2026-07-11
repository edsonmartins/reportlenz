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

import dev.reportlenz.render.batch.FilaDeRender;
import dev.reportlenz.render.batch.RepositorioDeJobs;
import tools.jackson.databind.json.JsonMapper;

/**
 * Batch assíncrono e idempotente (RFC-003 §4, tarefas 5.1/5.3).
 *
 * Com o registro de templates (ADR-009, phase-4/5.x), o lote aceita DUAS
 * formas: `jrxml`+`inputSchema` inline (compatibilidade) ou
 * `templateCodename` — que resolve a versão PUBLISHED do repositório (única
 * usável em produção, RFC-006 §2) e audita `rendered_batch` (LGPD).
 */
@RestController
public class BatchController {

    private final RepositorioDeJobs repositorio;
    private final FilaDeRender fila;
    private final dev.reportlenz.render.publish.RepositorioDeTemplates templates;
    private final JsonMapper mapper = JsonMapper.builder().build();

    public BatchController(RepositorioDeJobs repositorio, FilaDeRender fila,
            dev.reportlenz.render.publish.RepositorioDeTemplates templates) {
        this.repositorio = repositorio;
        this.fila = fila;
        this.templates = templates;
    }

    public record BatchRequest(
            String jrxml,
            Map<String, Object> inputSchema,
            String templateCodename,
            List<Map<String, Object>> payloads,
            String idempotencyKey) {}

    public record BatchResponse(String jobId) {}

    @PostMapping("/render/batch")
    public ResponseEntity<?> submeter(@RequestBody BatchRequest request) {
        boolean porRegistro = request.templateCodename() != null && !request.templateCodename().isBlank();
        if ((!porRegistro && (request.jrxml() == null || request.jrxml().isBlank()))
                || request.payloads() == null || request.payloads().isEmpty()
                || request.idempotencyKey() == null || request.idempotencyKey().isBlank()) {
            return ResponseEntity.badRequest()
                    .body(new TratadorDeErros.ErroResponse("REQUISICAO_INVALIDA",
                            "jrxml OU templateCodename, payloads (não vazio) e idempotencyKey são obrigatórios"));
        }

        String jrxml = request.jrxml();
        String inputSchemaJson = request.inputSchema() == null ? null : mapper.writeValueAsString(request.inputSchema());
        dev.reportlenz.render.publish.RepositorioDeTemplates.Versao versaoPublicada = null;
        if (porRegistro) {
            versaoPublicada = templates.publicada(request.templateCodename()).orElse(null);
            if (versaoPublicada == null) {
                // Só published é usável pelo batch (RFC-006 §2) — draft/deprecated não rendem.
                return ResponseEntity.status(HttpStatus.CONFLICT)
                        .body(new TratadorDeErros.ErroResponse("TEMPLATE_NAO_PUBLICADO",
                                request.templateCodename() + " não tem versão published"));
            }
            jrxml = versaoPublicada.jrxml();
            inputSchemaJson = versaoPublicada.inputSchemaJson();
        }

        var criado = repositorio.criarSeNovo(
                request.idempotencyKey(),
                jrxml,
                inputSchemaJson,
                mapper.writeValueAsString(request.payloads()),
                request.payloads().size());

        // Idempotência do lote: só o job NOVO entra na fila; reenvio devolve o mesmo jobId.
        if (criado.novo()) {
            fila.enfileirar(criado.jobId());
            if (versaoPublicada != null) {
                // Rastreabilidade LGPD (RFC-006 §4): qual versão gerou qual lote.
                templates.auditar(versaoPublicada.id(), "rendered_batch", null, mapper.writeValueAsString(Map.of(
                        "jobId", criado.jobId(),
                        "total", request.payloads().size(),
                        "idempotencyKey", request.idempotencyKey())));
            }
        }
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(new BatchResponse(criado.jobId()));
    }

    public record StatusResponse(String jobId, String status, int total, int done, int falhas,
            List<String> outputs, List<Map<String, Object>> erros) {}

    @GetMapping("/render/batch/{jobId}")
    public ResponseEntity<StatusResponse> status(@PathVariable String jobId) {
        return repositorio.consultar(jobId)
                .map(estado -> ResponseEntity.ok(new StatusResponse(
                        estado.jobId(),
                        estado.status(),
                        estado.total(),
                        estado.concluidos(),
                        estado.falhas(),
                        estado.saidas().stream().filter(s -> s.referencia() != null).map(s -> s.referencia()).toList(),
                        estado.saidas().stream().filter(s -> s.erro() != null)
                                .map(s -> Map.<String, Object>of("idx", s.idx(), "erro", s.erro())).toList())))
                .orElse(ResponseEntity.notFound().build());
    }
}
