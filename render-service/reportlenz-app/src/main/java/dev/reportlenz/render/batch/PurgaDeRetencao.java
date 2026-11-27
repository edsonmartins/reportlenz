package dev.reportlenz.render.batch;

import java.time.Duration;
import java.time.Instant;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import dev.reportlenz.render.storage.ArmazenamentoDeSaida;

/**
 * Purga de retenção (ADR-018 §1, LGPD): diariamente apaga jobs TERMINADOS há
 * mais de `reportlenz.retencao.dias` — saídas no storage (PDFs com dados
 * pessoais), linhas de saída e o job. Jobs em andamento e a auditoria de
 * templates ficam. Idempotente: várias instâncias podem rodar ao mesmo tempo.
 */
@Component
public class PurgaDeRetencao {

    private static final Logger log = LoggerFactory.getLogger(PurgaDeRetencao.class);

    private final RepositorioDeJobs repositorio;
    private final ArmazenamentoDeSaida armazenamento;
    private final int dias;

    public PurgaDeRetencao(RepositorioDeJobs repositorio, ArmazenamentoDeSaida armazenamento,
            @Value("${reportlenz.retencao.dias:30}") int dias) {
        this.repositorio = repositorio;
        this.armazenamento = armazenamento;
        this.dias = dias;
    }

    @Scheduled(cron = "${reportlenz.retencao.cron:0 30 3 * * *}")
    public void agendada() {
        executar(Instant.now());
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
