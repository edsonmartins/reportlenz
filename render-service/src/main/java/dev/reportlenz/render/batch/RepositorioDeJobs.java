package dev.reportlenz.render.batch;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * Estado durável do batch em SQLite (decisão 2026-07-09; PostgreSQL quando o
 * registro de templates do ADR-009 chegar). A idempotência do lote vive na
 * UNIQUE de `idempotency_key`; a de item, na PK (job_id, idx) das saídas.
 */
@Repository
public class RepositorioDeJobs {

    public record JobCriado(String jobId, boolean novo) {}

    public record EntradaDoJob(String jrxml, String inputSchemaJson, String payloadsJson) {}

    public record SaidaDeItem(int idx, String referencia, String erro) {}

    public record EstadoDoJob(String jobId, String status, int total, int concluidos, int falhas, List<SaidaDeItem> saidas) {}

    private final JdbcClient jdbc;

    public RepositorioDeJobs(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** Cria o job ou devolve o existente para a mesma idempotencyKey. */
    public JobCriado criarSeNovo(String idempotencyKey, String jrxml, String inputSchemaJson, String payloadsJson, int total) {
        String agora = Instant.now().toString();
        String novoId = UUID.randomUUID().toString();
        int inseridas = jdbc.sql("""
                        INSERT INTO render_job (id, idempotency_key, status, total, jrxml, input_schema, payloads, criado_em, atualizado_em)
                        VALUES (:id, :chave, 'queued', :total, :jrxml, :schema, :payloads, :agora, :agora)
                        ON CONFLICT(idempotency_key) DO NOTHING
                        """)
                .param("id", novoId)
                .param("chave", idempotencyKey)
                .param("total", total)
                .param("jrxml", jrxml)
                .param("schema", inputSchemaJson)
                .param("payloads", payloadsJson)
                .param("agora", agora)
                .update();

        if (inseridas > 0) {
            return new JobCriado(novoId, true);
        }
        String existente = jdbc.sql("SELECT id FROM render_job WHERE idempotency_key = :chave")
                .param("chave", idempotencyKey)
                .query(String.class)
                .single();
        return new JobCriado(existente, false);
    }

    public Optional<EntradaDoJob> carregarEntrada(String jobId) {
        return jdbc.sql("SELECT jrxml, input_schema, payloads FROM render_job WHERE id = :id")
                .param("id", jobId)
                .query((rs, i) -> new EntradaDoJob(rs.getString("jrxml"), rs.getString("input_schema"), rs.getString("payloads")))
                .optional();
    }

    public void atualizarStatus(String jobId, String status) {
        jdbc.sql("UPDATE render_job SET status = :status, atualizado_em = :agora WHERE id = :id")
                .param("status", status)
                .param("agora", Instant.now().toString())
                .param("id", jobId)
                .update();
    }

    /** Índices já processados (reprocessamento idempotente pula estes). */
    public Set<Integer> indicesProcessados(String jobId) {
        return jdbc.sql("SELECT idx FROM render_job_saida WHERE job_id = :id")
                .param("id", jobId)
                .query(Integer.class)
                .list()
                .stream()
                .collect(Collectors.toSet());
    }

    /** Registra a saída de um item (ON CONFLICT DO NOTHING: item já feito não duplica — SQL portável SQLite/PostgreSQL). */
    public void registrarSaida(String jobId, int idx, String referencia, String erro) {
        int inseridas = jdbc.sql("""
                        INSERT INTO render_job_saida (job_id, idx, referencia, erro)
                        VALUES (:job, :idx, :ref, :erro)
                        ON CONFLICT (job_id, idx) DO NOTHING
                        """)
                .param("job", jobId)
                .param("idx", idx)
                .param("ref", referencia)
                .param("erro", erro)
                .update();
        if (inseridas > 0) {
            String coluna = erro == null ? "concluidos" : "falhas";
            jdbc.sql("UPDATE render_job SET " + coluna + " = " + coluna + " + 1, atualizado_em = :agora WHERE id = :id")
                    .param("agora", Instant.now().toString())
                    .param("id", jobId)
                    .update();
        }
    }

    public Optional<EstadoDoJob> consultar(String jobId) {
        Optional<EstadoDoJob> job = jdbc.sql("SELECT id, status, total, concluidos, falhas FROM render_job WHERE id = :id")
                .param("id", jobId)
                .query((rs, i) -> new EstadoDoJob(
                        rs.getString("id"),
                        rs.getString("status"),
                        rs.getInt("total"),
                        rs.getInt("concluidos"),
                        rs.getInt("falhas"),
                        List.of()))
                .optional();
        return job.map(j -> new EstadoDoJob(j.jobId(), j.status(), j.total(), j.concluidos(), j.falhas(),
                jdbc.sql("SELECT idx, referencia, erro FROM render_job_saida WHERE job_id = :id ORDER BY idx")
                        .param("id", jobId)
                        .query((rs, i) -> new SaidaDeItem(rs.getInt("idx"), rs.getString("referencia"), rs.getString("erro")))
                        .list()));
    }
}
