package dev.reportlenz.render.persistencia;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/**
 * Flyway (ADR-018, change endurecimento-operacional/2.1) — cenário "Banco
 * legado": um SQLite criado pelo antigo schema.sql (sem histórico do Flyway)
 * migra sem erro e sem perder dados; banco novo recebe V1 + V2.
 */
class MigracoesTest {

    @TempDir
    Path tmp;

    /** As migrações REAIS do starter (ADR-026): instância Flyway própria, tabela própria. */
    private static int migrarReportLenz(String url) {
        org.sqlite.SQLiteDataSource ds = new org.sqlite.SQLiteDataSource();
        ds.setUrl(url);
        return new dev.reportlenz.render.config.MigracoesDoReportLenz(ds, "reportlenz_schema_history").migrar();
    }

    private static String versoes(Statement st, String tabela) throws Exception {
        StringBuilder versoes = new StringBuilder();
        try (ResultSet rs = st.executeQuery("SELECT version FROM " + tabela
                + " WHERE success = 1 AND version IS NOT NULL ORDER BY installed_rank")) {
            while (rs.next()) {
                versoes.append(rs.getString(1)).append(' ');
            }
        }
        return versoes.toString().strip();
    }

    @Test
    void cenarioDoSpec_bancoLegadoMigraSemPerderDados() throws Exception {
        String url = "jdbc:sqlite:" + tmp.resolve("legado.db");
        String ddlLegado;
        try (var in = getClass().getClassLoader().getResourceAsStream("reportlenz/db/migration/V1__baseline.sql")) {
            ddlLegado = new String(in.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8);
        }
        try (Connection c = DriverManager.getConnection(url); Statement st = c.createStatement()) {
            // Remove comentários (alguns contêm ';') antes de separar os comandos.
            String semComentarios = ddlLegado.replaceAll("--[^\n]*", "");
            for (String comando : semComentarios.split(";")) {
                String sql = comando.strip();
                if (!sql.isEmpty()) {
                    st.execute(sql);
                }
            }
            st.execute("INSERT INTO report_template (id, codename, criado_em) VALUES ('t1', 'legado', '2026-01-01')");
        }

        migrarReportLenz(url);

        try (Connection c = DriverManager.getConnection(url); Statement st = c.createStatement()) {
            try (ResultSet rs = st.executeQuery("SELECT codename FROM report_template WHERE id = 't1'")) {
                assertThat(rs.next()).isTrue();
                assertThat(rs.getString(1)).isEqualTo("legado");
            }
            assertThat(versoes(st, "reportlenz_schema_history")).isEqualTo("0 1 2");
            try (ResultSet rs = st.executeQuery(
                    "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_render_job_retencao'")) {
                assertThat(rs.next()).isTrue();
            }
        }
    }

    @Test
    void bancoNovoRecebeV1EV2() throws Exception {
        String url = "jdbc:sqlite:" + tmp.resolve("novo.db");
        assertThat(migrarReportLenz(url)).isEqualTo(2);
        // Idempotente: segunda execução não aplica nada.
        assertThat(migrarReportLenz(url)).isZero();
    }

    /**
     * Scenario "Flyway isolado" (ADR-026 §3): a APLICAÇÃO tem o próprio Flyway
     * (V1, V2 em flyway_schema_history); as migrações do ReportLenz rodam na
     * tabela própria, sem conflito de versões nem toque no histórico dela.
     */
    @Test
    void flywayDaAplicacaoEDoReportLenzConvivem() throws Exception {
        String url = "jdbc:sqlite:" + tmp.resolve("aplicacao.db");
        var daAplicacao = Flyway.configure().dataSource(url, null, null)
                .locations("classpath:aplicacao-hospedeira/db/migration").load();
        assertThat(daAplicacao.migrate().migrationsExecuted).isEqualTo(2);

        assertThat(migrarReportLenz(url)).isEqualTo(2);

        try (Connection c = DriverManager.getConnection(url); Statement st = c.createStatement()) {
            assertThat(versoes(st, "flyway_schema_history")).isEqualTo("1 2");
            assertThat(versoes(st, "reportlenz_schema_history")).isEqualTo("0 1 2");
            try (ResultSet rs = st.executeQuery("SELECT count(*) FROM pedido_da_aplicacao")) {
                assertThat(rs.next()).isTrue();
            }
        }
        // A aplicação segue validando o próprio histórico (nada estranho nele).
        assertThat(daAplicacao.validateWithResult().validationSuccessful).isTrue();
    }
}
