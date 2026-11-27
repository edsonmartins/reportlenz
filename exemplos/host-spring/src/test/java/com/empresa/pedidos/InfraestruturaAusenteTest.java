package com.empresa.pedidos;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;

/** Scenario "Infraestrutura ausente" (ADR-026 §3): batch ligado sem Redis → boot falha dizendo o que fazer. */
class InfraestruturaAusenteTest {

    /** Argumentos de linha de comando: vencem o application.yml (properties() seriam só defaults). */
    private static ConfigurableApplicationContext subir(String... extras) {
        java.util.List<String> args = new java.util.ArrayList<>(java.util.List.of("--server.port=0",
                "--spring.datasource.url=jdbc:sqlite:target/infra-ausente.db",
                "--spring.data.redis.port=1", "--spring.data.redis.timeout=500ms"));
        for (String e : extras) args.add("--" + e);
        return new SpringApplicationBuilder(PedidosApplication.class).run(args.toArray(String[]::new));
    }

    @Test
    void batchHabilitadoSemRedisFalhaComMensagemClara() {
        assertThatThrownBy(() -> subir().close())
                .hasStackTraceContaining("Batch do ReportLenz habilitado, mas o Redis não responde")
                .hasStackTraceContaining("reportlenz.batch.habilitado=false");
    }

    @Test
    void batchDesligadoSobeSemRedis() {
        try (ConfigurableApplicationContext ctx = subir("reportlenz.batch.habilitado=false",
                "reportlenz.compile-cache.compartilhado=false")) {
            assertThat(ctx.containsBean("batchController")).isFalse();
            assertThat(ctx.containsBean("previewController")).isTrue();
        }
    }
}
