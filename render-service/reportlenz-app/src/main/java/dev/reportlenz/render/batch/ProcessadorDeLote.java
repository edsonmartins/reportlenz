package dev.reportlenz.render.batch;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.SmartLifecycle;
import org.springframework.stereotype.Component;

import dev.reportlenz.render.pipeline.PipelineDeRender;
import dev.reportlenz.render.pipeline.ValidadorDePayload;
import dev.reportlenz.render.storage.ArmazenamentoDeSaida;
import io.micrometer.observation.Observation;
import io.micrometer.observation.ObservationRegistry;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/**
 * Worker do batch (RFC-003 §4, tarefas 5.1-5.2): consome jobIds da fila Redis
 * e processa cada lote — compile ÚNICO (o pipeline cacheia por sha256, ADR-008)
 * e fill N, validando cada payload contra o inputSchema quando presente.
 *
 * Idempotência em dois níveis: lote (UNIQUE idempotency_key na criação) e item
 * (PK job_id+idx: reprocessar um job pula itens já concluídos — sem duplicar).
 * Item inválido/quebrado vira falha registrada; o lote segue.
 */
@Component
public class ProcessadorDeLote implements SmartLifecycle {

    private static final Logger log = LoggerFactory.getLogger(ProcessadorDeLote.class);
    private static final Duration ESPERA_FILA = Duration.ofSeconds(1);

    private final FilaDeRender fila;
    private final RepositorioDeJobs repositorio;
    private final PipelineDeRender pipeline;
    private final ValidadorDePayload validador;
    private final ArmazenamentoDeSaida armazenamento;
    private final ObservationRegistry observacoes;
    private final JsonMapper mapper = JsonMapper.builder().build();

    private final AtomicBoolean rodando = new AtomicBoolean(false);
    private Thread trabalhador;

    public ProcessadorDeLote(FilaDeRender fila, RepositorioDeJobs repositorio, PipelineDeRender pipeline,
            ValidadorDePayload validador, ArmazenamentoDeSaida armazenamento, ObservationRegistry observacoes) {
        this.fila = fila;
        this.repositorio = repositorio;
        this.pipeline = pipeline;
        this.validador = validador;
        this.armazenamento = armazenamento;
        this.observacoes = observacoes;
    }

    // ------------------------------------------------------------------ ciclo

    @Override
    public void start() {
        rodando.set(true);
        trabalhador = new Thread(this::consumir, "reportlenz-batch-worker");
        trabalhador.setDaemon(true);
        trabalhador.start();
    }

    @Override
    public void stop() {
        rodando.set(false);
        if (trabalhador != null) {
            trabalhador.interrupt();
        }
    }

    @Override
    public boolean isRunning() {
        return rodando.get();
    }

    /** Reentregas acima disto = mensagem venenosa: job vira failed e sai da fila. */
    private static final long MAX_ENTREGAS = 5;

    private void consumir() {
        while (rodando.get()) {
            try {
                FilaDeRender.Mensagem mensagem = fila.aguardar(ESPERA_FILA);
                if (mensagem == null) {
                    continue;
                }
                if (mensagem.entregas() > MAX_ENTREGAS) {
                    // Poison cap (change fila-redis-streams): não roda a N-ésima vez.
                    log.error("[BATCH] job {} excedeu {} entregas — marcado failed e removido da fila",
                            mensagem.jobId(), MAX_ENTREGAS);
                    repositorio.atualizarStatus(mensagem.jobId(), "failed");
                    fila.confirmar(mensagem.recordId());
                    continue;
                }
                processar(mensagem.jobId());
                // At-least-once: ACK só DEPOIS do processamento — worker que morre
                // no meio deixa a mensagem pendente para outra instância reivindicar.
                fila.confirmar(mensagem.recordId());
            } catch (Exception e) {
                if (rodando.get()) {
                    // Sem ACK: a mensagem fica pendente e será reentregue.
                    log.error("[BATCH] erro no consumo da fila: {}", e.getMessage(), e);
                }
            }
        }
    }

    // -------------------------------------------------------------- processo

    void processar(String jobId) {
        // Span do job inteiro; compile/fill/export têm spans próprios no pipeline.
        Observation.createNotStarted("render.batch.job", observacoes).observe(() -> processarJob(jobId));
    }

    private void processarJob(String jobId) {
        var entrada = repositorio.carregarEntrada(jobId).orElse(null);
        if (entrada == null) {
            log.warn("[BATCH] jobId desconhecido na fila: {}", jobId);
            return;
        }
        repositorio.atualizarStatus(jobId, "running");
        log.info("[BATCH] processando job {}", jobId);

        List<Map<String, Object>> payloads =
                mapper.readValue(entrada.payloadsJson(), new TypeReference<List<Map<String, Object>>>() {});
        Map<String, Object> inputSchema = entrada.inputSchemaJson() == null
                ? null
                : mapper.readValue(entrada.inputSchemaJson(), new TypeReference<Map<String, Object>>() {});

        // Reprocessamento idempotente: itens já registrados não rodam de novo.
        Set<Integer> feitos = repositorio.indicesProcessados(jobId);

        for (int idx = 0; idx < payloads.size(); idx++) {
            if (feitos.contains(idx)) {
                continue;
            }
            Map<String, Object> payload = payloads.get(idx);
            try {
                if (inputSchema != null) {
                    validador.validar(inputSchema, payload);
                }
                // Compile único p/ o lote: mesmo jrxml → cache hit por sha256 (ADR-008).
                byte[] pdf = pipeline.renderizarPdf(entrada.jrxml(), payload);
                String referencia = armazenamento.salvar(jobId, idx + ".pdf", pdf);
                repositorio.registrarSaida(jobId, idx, referencia, null);
            } catch (Exception e) {
                repositorio.registrarSaida(jobId, idx, null, e.getMessage());
            }
        }

        repositorio.atualizarStatus(jobId, "done");
        log.info("[BATCH] job {} concluído", jobId);
    }
}
