package dev.reportlenz.render.config;

import javax.sql.DataSource;

import org.flywaydb.core.Flyway;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Migrações do ReportLenz numa instância Flyway PRÓPRIA (ADR-026 §3): tabela
 * de histórico {@code reportlenz_schema_history} e scripts em
 * {@code classpath:reportlenz/db/migration} — o Flyway da aplicação
 * hospedeira (V1, V2… em {@code flyway_schema_history}) não é tocado.
 *
 * Baseline 0: bancos que já tinham as tabelas (render-service antes do
 * ADR-026, histórico na tabela padrão) recebem o V1/V2, que são idempotentes
 * (IF NOT EXISTS).
 */
@Component(MigracoesDoReportLenz.NOME)
@org.springframework.boot.autoconfigure.condition.ConditionalOnExpression("${reportlenz.registro.habilitado:true} or ${reportlenz.batch.habilitado:true}")
public class MigracoesDoReportLenz implements InitializingBean {

    public static final String NOME = "migracoesDoReportLenz";

    private static final Logger log = LoggerFactory.getLogger(MigracoesDoReportLenz.class);

    private final DataSource dataSource;
    private final String tabela;

    public MigracoesDoReportLenz(DataSource dataSource,
            @Value("${reportlenz.migracoes.tabela:reportlenz_schema_history}") String tabela) {
        this.dataSource = dataSource;
        this.tabela = tabela;
    }

    @Override
    public void afterPropertiesSet() {
        migrar();
    }

    /** @return quantas migrações foram aplicadas */
    public int migrar() {
        var resultado = Flyway.configure()
                .dataSource(dataSource)
                .table(tabela)
                .locations("classpath:reportlenz/db/migration")
                .baselineOnMigrate(true)
                .baselineVersion("0")
                .load()
                .migrate();
        log.info("[MIGRACOES] ReportLenz em {}: {} migração(ões) aplicada(s), versão {}", tabela,
                resultado.migrationsExecuted, resultado.targetSchemaVersion);
        return resultado.migrationsExecuted;
    }
}
