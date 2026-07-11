package dev.reportlenz.render.publish;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * Repositório de templates (ADR-009 / RFC-006 §2, tarefas phase-4/5.1-5.3):
 * versionamento conjunto JRXML+inputSchema, ciclo de vida
 * draft→published→deprecated e auditoria LGPD.
 *
 * Regras de imutabilidade (RFC-006 §7):
 * - `draft` é MUTÁVEL: salvar de novo atualiza a mesma versão;
 * - `published` é IMUTÁVEL: salvar depois de publicar cria NOVA versão draft;
 * - publicar deprecia automaticamente a versão published anterior (supersede).
 */
@Repository
public class RepositorioDeTemplates {

    public record Versao(
            String id,
            String codename,
            int version,
            String jrxml,
            String inputSchemaJson,
            String jrxmlHash,
            String status,
            String criadoEm,
            String criadoPor) {}

    public record VersaoSalva(String versionId, int version, boolean novaVersao) {}

    /** Tentativa de mutar versão imutável (published/deprecated) → 409. */
    public static final class VersaoImutavel extends RuntimeException {
        public VersaoImutavel(String mensagem) {
            super(mensagem);
        }
    }

    private final JdbcClient jdbc;

    public RepositorioDeTemplates(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Salva o draft do template: reaproveita a versão draft mais recente
     * (draft é mutável) ou abre a próxima versão quando a última é
     * published/deprecated (imutabilidade — ADR-009 regra 1).
     */
    public VersaoSalva salvarDraft(String codename, String jrxml, String inputSchemaJson, String jrxmlHash, String actor) {
        String agora = Instant.now().toString();
        String templateId = jdbc.sql("SELECT id FROM report_template WHERE codename = :codename")
                .param("codename", codename)
                .query(String.class)
                .optional()
                .orElseGet(() -> {
                    String novo = UUID.randomUUID().toString();
                    jdbc.sql("INSERT INTO report_template (id, codename, criado_em) VALUES (:id, :codename, :agora)")
                            .param("id", novo).param("codename", codename).param("agora", agora)
                            .update();
                    return novo;
                });

        Optional<Versao> ultima = ultimaVersao(templateId);
        if (ultima.isPresent() && "draft".equals(ultima.get().status())) {
            jdbc.sql("""
                            UPDATE report_template_version
                            SET jrxml = :jrxml, input_schema = :schema, jrxml_hash = :hash, criado_em = :agora, criado_por = :actor
                            WHERE id = :id
                            """)
                    .param("jrxml", jrxml).param("schema", inputSchemaJson).param("hash", jrxmlHash)
                    .param("agora", agora).param("actor", actor).param("id", ultima.get().id())
                    .update();
            return new VersaoSalva(ultima.get().id(), ultima.get().version(), false);
        }

        int proxima = ultima.map(v -> v.version() + 1).orElse(1);
        String versionId = UUID.randomUUID().toString();
        jdbc.sql("""
                        INSERT INTO report_template_version
                            (id, template_id, version, jrxml, input_schema, jrxml_hash, status, criado_em, criado_por)
                        VALUES (:id, :templateId, :version, :jrxml, :schema, :hash, 'draft', :agora, :actor)
                        """)
                .param("id", versionId).param("templateId", templateId).param("version", proxima)
                .param("jrxml", jrxml).param("schema", inputSchemaJson).param("hash", jrxmlHash)
                .param("agora", agora).param("actor", actor)
                .update();
        auditar(versionId, "created", actor, null);
        return new VersaoSalva(versionId, proxima, true);
    }

    /** Publica a versão draft; a published anterior do template é depreciada. */
    public void publicar(Versao versao, String actor) {
        if (!"draft".equals(versao.status())) {
            throw new VersaoImutavel("versão " + versao.version() + " está '" + versao.status()
                    + "' — published é imutável; edite e publique uma NOVA versão");
        }
        String templateId = templateIdDe(versao.codename());
        // Supersede: a published anterior vira deprecated (RFC-006 §2).
        jdbc.sql("SELECT id FROM report_template_version WHERE template_id = :t AND status = 'published'")
                .param("t", templateId)
                .query(String.class)
                .list()
                .forEach(anterior -> {
                    jdbc.sql("UPDATE report_template_version SET status = 'deprecated' WHERE id = :id")
                            .param("id", anterior).update();
                    auditar(anterior, "deprecated", actor, "{\"motivo\":\"superseded\",\"por\":" + versao.version() + "}");
                });
        jdbc.sql("UPDATE report_template_version SET status = 'published' WHERE id = :id")
                .param("id", versao.id()).update();
        auditar(versao.id(), "published", actor, null);
    }

    /** Depreciação manual (fora do supersede automático). */
    public void deprecar(Versao versao, String actor) {
        if (!"published".equals(versao.status())) {
            throw new VersaoImutavel("só versão published pode ser depreciada (atual: '" + versao.status() + "')");
        }
        jdbc.sql("UPDATE report_template_version SET status = 'deprecated' WHERE id = :id")
                .param("id", versao.id()).update();
        auditar(versao.id(), "deprecated", actor, null);
    }

    public Optional<Versao> consultar(String codename, int version) {
        return jdbc.sql(SELECT_VERSAO + " WHERE t.codename = :codename AND v.version = :version")
                .param("codename", codename).param("version", version)
                .query(this::mapear)
                .optional();
    }

    /** A versão published do template — a única usável pelo batch (RFC-006 §2). */
    public Optional<Versao> publicada(String codename) {
        return jdbc.sql(SELECT_VERSAO + " WHERE t.codename = :codename AND v.status = 'published'")
                .param("codename", codename)
                .query(this::mapear)
                .optional();
    }

    public List<Versao> listar(String codename) {
        return jdbc.sql(SELECT_VERSAO + " WHERE t.codename = :codename ORDER BY v.version")
                .param("codename", codename)
                .query(this::mapear)
                .list();
    }

    /** Trilha de auditoria (ex.: verificação nos testes e na API de governança). */
    public List<String> acoesAuditadas(String versionId) {
        return jdbc.sql("SELECT action FROM report_template_audit WHERE version_id = :id ORDER BY at, rowid")
                .param("id", versionId)
                .query(String.class)
                .list();
    }

    /** Registra evento de auditoria (RFC-006 §4) — o batch usa `rendered_batch`. */
    public void auditar(String versionId, String action, String actor, String metaJson) {
        jdbc.sql("""
                        INSERT INTO report_template_audit (id, version_id, action, actor, at, meta)
                        VALUES (:id, :versionId, :action, :actor, :at, :meta)
                        """)
                .param("id", UUID.randomUUID().toString()).param("versionId", versionId)
                .param("action", action).param("actor", actor)
                .param("at", Instant.now().toString()).param("meta", metaJson)
                .update();
    }

    private static final String SELECT_VERSAO = """
            SELECT v.id, t.codename, v.version, v.jrxml, v.input_schema, v.jrxml_hash, v.status, v.criado_em, v.criado_por
            FROM report_template_version v JOIN report_template t ON t.id = v.template_id
            """;

    private Versao mapear(java.sql.ResultSet rs, int rowNum) throws java.sql.SQLException {
        return new Versao(rs.getString(1), rs.getString(2), rs.getInt(3), rs.getString(4),
                rs.getString(5), rs.getString(6), rs.getString(7), rs.getString(8), rs.getString(9));
    }

    private String templateIdDe(String codename) {
        return jdbc.sql("SELECT id FROM report_template WHERE codename = :codename")
                .param("codename", codename)
                .query(String.class)
                .single();
    }

    private Optional<Versao> ultimaVersao(String templateId) {
        return jdbc.sql(SELECT_VERSAO + " WHERE v.template_id = :t ORDER BY v.version DESC LIMIT 1")
                .param("t", templateId)
                .query(this::mapear)
                .optional();
    }
}
