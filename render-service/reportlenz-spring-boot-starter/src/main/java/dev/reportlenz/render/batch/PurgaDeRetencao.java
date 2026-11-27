package dev.reportlenz.render.batch;

import dev.reportlenz.render.config.RecursoBatch;

import java.time.Duration;
import java.time.Instant;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import dev.reportlenz.render.storage.ArmazenamentoDeSaida;

/**
 * Purga de retenção (ADR-018 §1, LGPD): diariamente apaga jobs TERMINADOS há
 * mais de `reportlenz.retencao.dias` — saídas no storage (PDFs com dados
 * pessoais), linhas de saída e o job. Jobs em andamento e a auditoria de
 * templates ficam. Idempotente: várias instâncias podem rodar ao mesmo tempo.
 */
@Component
@RecursoBatch
public class PurgaDeRetencao implements org.springframework.context.SmartLifecycle {

    private static final Logger log = LoggerFactory.getLogger(PurgaDeRetencao.class);

    private final RepositorioDeJobs repositorio;
    private final ArmazenamentoDeSaida armazenamento;
    private final int dias;
    /**
     * Agendador PRÓPRIO (ADR-026 §3): `@EnableScheduling` no starter ligaria os
     * `@Scheduled` da aplicação hospedeira que ela deixou desligados.
     */
    private String cron = "0 30 3 * * *";
    private org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler agendador;

    public PurgaDeRetencao(RepositorioDeJobs repositorio, ArmazenamentoDeSaida armazenamento,
            @Value("${reportlenz.retencao.dias:30}") int dias) {
        this.repositorio = repositorio;
        this.armazenamento = armazenamento;
        this.dias = dias;
    }

    @Value("${reportlenz.retencao.cron:0 30 3 * * *}")
    void cron(String cron) {
        this.cron = cron;
    }

    public void agendada() {
        executar(Instant.now());
    }

    @Override
    public synchronized void start() {
        if (agendador != null) return;
        agendador = new org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler();
        agendador.setPoolSize(1);
        agendador.setThreadNamePrefix("reportlenz-retencao-");
        agendador.initialize();
        agendador.schedule(this::agendada, new org.springframework.scheduling.support.CronTrigger(cron));
        log.info("[RETENCAO] purga agendada ({}), retenção de {} dias", cron, dias);
    }

    @Override
    public synchronized void stop() {
        if (agendador != null) {
            agendador.shutdown();
            agendador = null;
        }
    }

    @Override
    public synchronized boolean isRunning() {
        return agendador != null;
    }

    /** @return quantos jobs foram purgados */
    public int executar(Instant agora) {
        Instant limite = agora.minus(Duration.ofDays(dias));
        int purgados = 0;
        for (String jobId : repositorio.terminadosAntesDe(limite)) {
            try {
                // Storage primeiro: se falhar, o job fica e a próxima purga tenta de novo.
                armazenamento.removerSaidasDoJob(jobId);
                repositorio.apagar(jobId);
                purgados++;
            } catch (RuntimeException e) {
                log.error("[RETENCAO] falha ao purgar job {}: {}", jobId, e.getMessage());
            }
        }
        if (purgados > 0) {
            log.info("[RETENCAO] {} job(s) terminados antes de {} purgados ({} dias)", purgados, limite, dias);
        }
        return purgados;
    }
}
