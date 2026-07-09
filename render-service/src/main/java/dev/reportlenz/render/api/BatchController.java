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
 * Nota de contrato: enquanto o registro de templates (ADR-009) não existe, o
 * lote recebe `jrxml` + `inputSchema` inline — o mesmo par que o registro
 * versionará; `templateId`+`version` entram quando o registro chegar.
 */
@RestController
public class BatchController {

    private final RepositorioDeJobs repositorio;
    private final FilaDeRender fila;
    private final JsonMapper mapper = JsonMapper.builder().build();

    public BatchController(RepositorioDeJobs repositorio, FilaDeRender fila) {
        this.repositorio = repositorio;
        this.fila = fila;
    }

    public record BatchRequest(
            String jrxml,
            Map<String, Object> inputSchema,
            List<Map<String, Object>> payloads,
            String idempotencyKey) {}

    public record BatchResponse(String jobId) {}

    @PostMapping("/render/batch")
    public ResponseEntity<?> submeter(@RequestBody BatchRequest request) {
        if (request.jrxml() == null || request.jrxml().isBlank()
                || request.payloads() == null || request.payloads().isEmpty()
                || request.idempotencyKey() == null || request.idempotencyKey().isBlank()) {
            return ResponseEntity.badRequest()
                    .body(new TratadorDeErros.ErroResponse("REQUISICAO_INVALIDA",
                            "jrxml, payloads (não vazio) e idempotencyKey são obrigatórios"));
        }

        var criado = repositorio.criarSeNovo(
                request.idempotencyKey(),
                request.jrxml(),
                request.inputSchema() == null ? null : mapper.writeValueAsString(request.inputSchema()),
                mapper.writeValueAsString(request.payloads()),
                request.payloads().size());

        // Idempotência do lote: só o job NOVO entra na fila; reenvio devolve o mesmo jobId.
        if (criado.novo()) {
            fila.enfileirar(criado.jobId());
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
