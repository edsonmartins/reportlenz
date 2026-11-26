package dev.reportlenz.render.persistencia;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
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

    private static Flyway flyway(String url) {
        // Mesma configuração do application.yml.
        return Flyway.configure()
                .dataSource(url, null, null)
                .locations("classpath:db/migration")
                .baselineOnMigrate(true)
                .baselineVersion("0")
                .load();
    }

    @Test
    void cenarioDoSpec_bancoLegadoMigraSemPerderDados() throws Exception {
        String url = "jdbc:sqlite:" + tmp.resolve("legado.db");
        String ddlLegado = Files.readString(Path.of("src/main/resources/db/migration/V1__baseline.sql"));
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

        var resultado = flyway(url).migrate();
        assertThat(resultado.success).isTrue();

        try (Connection c = DriverManager.getConnection(url); Statement st = c.createStatement()) {
            try (ResultSet rs = st.executeQuery("SELECT codename FROM report_template WHERE id = 't1'")) {
                assertThat(rs.next()).isTrue();
                assertThat(rs.getString(1)).isEqualTo("legado");
            }
            try (ResultSet rs = st.executeQuery(
                    "SELECT version FROM flyway_schema_history WHERE success = 1 AND version IS NOT NULL ORDER BY installed_rank")) {
                StringBuilder versoes = new StringBuilder();
                while (rs.next()) {
                    versoes.append(rs.getString(1)).append(' ');
                }
                assertThat(versoes.toString().strip()).isEqualTo("0 1 2");
            }
            try (ResultSet rs = st.executeQuery(
                    "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_render_job_retencao'")) {
                assertThat(rs.next()).isTrue();
            }
        }
    }

    @Test
    void bancoNovoRecebeV1EV2() throws Exception {
        String url = "jdbc:sqlite:" + tmp.resolve("novo.db");
        var resultado = flyway(url).migrate();
        assertThat(resultado.migrationsExecuted).isEqualTo(2);
        // Idempotente: segunda execução não aplica nada.
        assertThat(flyway(url).migrate().migrationsExecuted).isZero();
    }
}
