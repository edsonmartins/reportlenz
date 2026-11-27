package dev.reportlenz.render.api;

import dev.reportlenz.render.seguranca.IdentidadeAtual;

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
 * O lote aceita SOMENTE `templateCodename` (ADR-016 §3): resolve a versão
 * PUBLISHED do repositório (RFC-006 §2), que passou pelos gates G1–G7, e
 * audita `rendered_batch` (LGPD). O modo `jrxml` inline foi removido —
 * pedido com `jrxml` bruto → 400 `JRXML_BRUTO_PROIBIDO`.
 */
@RestController
public class BatchController {

    private final RepositorioDeJobs repositorio;
    private final FilaDeRender fila;
    private final dev.reportlenz.render.publish.RepositorioDeTemplates templates;
    private final dev.reportlenz.render.storage.ArmazenamentoDeSaida armazenamento;
    private final JsonMapper mapper = JsonMapper.builder().build();

    /** ADR-018 §2: teto de itens por lote (payloads ficam num único JSON no banco). */
    private final int maxItens;

    public BatchController(RepositorioDeJobs repositorio, FilaDeRender fila,
            dev.reportlenz.render.publish.RepositorioDeTemplates templates,
            dev.reportlenz.render.storage.ArmazenamentoDeSaida armazenamento,
            @org.springframework.beans.factory.annotation.Value("${reportlenz.limites.batch-max-itens:20000}") int maxItens) {
        this.maxItens = maxItens;
        this.repositorio = repositorio;
        this.fila = fila;
        this.templates = templates;
        this.armazenamento = armazenamento;
    }

    /**
     * `jrxml`/`inputSchema` permanecem no record só para recusar explicitamente
     * o modo bruto (400 JRXML_BRUTO_PROIBIDO, ADR-016) em vez de ignorá-los.
     */
    public record BatchRequest(
            String jrxml,
            Map<String, Object> inputSchema,
            String templateCodename,
            List<Map<String, Object>> payloads,
            String idempotencyKey) {}

    public record BatchResponse(String jobId) {}

    @PostMapping("/render/batch")
    public ResponseEntity<?> submeter(@RequestBody BatchRequest request) {
        // ADR-016 §3: lote SÓ de template publicado — JRXML bruto não passou pelos
        // gates G1–G7 nem gera trilha de auditoria por versão (RFC-006 §4).
        boolean porRegistro = request.templateCodename() != null && !request.templateCodename().isBlank();
        if (!porRegistro && request.jrxml() != null && !request.jrxml().isBlank()) {
            return ResponseEntity.badRequest()
                    .body(new TratadorDeErros.ErroResponse("JRXML_BRUTO_PROIBIDO",
                            "batch aceita apenas templateCodename com versão published (ADR-016); "
                                    + "publique o template antes de renderizar em lote"));
        }
        if (!porRegistro
                || request.payloads() == null || request.payloads().isEmpty()
                || request.idempotencyKey() == null || request.idempotencyKey().isBlank()) {
            return ResponseEntity.badRequest()
                    .body(new TratadorDeErros.ErroResponse("REQUISICAO_INVALIDA",
                            "templateCodename, payloads (não vazio) e idempotencyKey são obrigatórios"));
        }

        if (request.payloads().size() > maxItens) {
            return ResponseEntity.badRequest()
                    .body(new TratadorDeErros.ErroResponse("LOTE_GRANDE_DEMAIS",
                            request.payloads().size() + " itens; o máximo por lote é " + maxItens
                                    + " (REPORTLENZ_BATCH_MAX_ITENS) — divida em lotes menores"));
        }

        var versaoPublicada = templates.publicada(request.templateCodename()).orElse(null);
        if (versaoPublicada == null) {
            // Só published é usável pelo batch (RFC-006 §2) — draft/deprecated não rendem.
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(new TratadorDeErros.ErroResponse("TEMPLATE_NAO_PUBLICADO",
                            request.templateCodename() + " não tem versão published"));
        }
        String jrxml = versaoPublicada.jrxml();
        String inputSchemaJson = versaoPublicada.inputSchemaJson();

        var criado = repositorio.criarSeNovo(
                request.idempotencyKey(),
                jrxml,
                inputSchemaJson,
                mapper.writeValueAsString(request.payloads()),
                request.payloads().size());

        // Idempotência do lote: só o job NOVO entra na fila; reenvio devolve o mesmo jobId.
        if (criado.novo()) {
            fila.enfileirar(criado.jobId());
            // Rastreabilidade LGPD (RFC-006 §4): qual versão gerou qual lote.
            templates.auditar(versaoPublicada.id(), "rendered_batch", IdentidadeAtual.ator(), mapper.writeValueAsString(Map.of(
                    "jobId", criado.jobId(),
                    "total", request.payloads().size(),
                    "idempotencyKey", request.idempotencyKey())));
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
                        // Presign NA CONSULTA (change presigned-urls-minio): a referência
                        // persistida é canônica; a URL assinada nasce fresca a cada status.
                        estado.saidas().stream().filter(s -> s.referencia() != null)
                                .map(s -> armazenamento.linkDeDownload(s.referencia())).toList(),
                        estado.saidas().stream().filter(s -> s.erro() != null)
                                .map(s -> Map.<String, Object>of("idx", s.idx(), "erro", s.erro())).toList())))
                .orElse(ResponseEntity.notFound().build());
    }
}
