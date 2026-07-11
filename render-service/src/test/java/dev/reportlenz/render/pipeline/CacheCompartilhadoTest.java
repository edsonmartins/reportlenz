package dev.reportlenz.render.pipeline;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Function;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;

import net.sf.jasperreports.engine.JasperReport;

/**
 * Compile cache compartilhado (change cache-compilacao-redis, tarefas 1.1-1.3):
 * segunda instância reaproveita o `.jasper` do Redis sem recompilar; hit L1
 * não vai à rede; Redis fora do ar degrada para compilação local.
 *
 * Requer Redis acessível (local em dev; service container no CI) — mesmo
 * requisito do BatchFlowTest.
 */
class CacheCompartilhadoTest {

    private static LettuceConnectionFactory factory;

    @BeforeAll
    static void abrirRedis() {
        factory = new LettuceConnectionFactory("localhost", 6379);
        factory.afterPropertiesSet();
        factory.start();
    }

    @AfterAll
    static void fecharRedis() {
        factory.destroy();
    }

    private static String jrxmlUnico() {
        return """
                <?xml version="1.0" encoding="UTF-8"?>
                <jasperReport name="cache_%s" pageWidth="595" pageHeight="842" columnWidth="555" \
                leftMargin="20" rightMargin="20" topMargin="30" bottomMargin="30">
                \t<field name="nome" class="java.lang.String"/>
                \t<detail>
                \t\t<band height="20">
                \t\t\t<element kind="textField" x="0" y="0" width="555" height="16">
                \t\t\t\t<expression><![CDATA[$F{nome}]]></expression>
                \t\t\t</element>
                \t\t</band>
                \t</detail>
                </jasperReport>
                """.formatted(UUID.randomUUID().toString().substring(0, 8));
    }

    private static Function<String, JasperReport> compiladorContando(AtomicInteger contador) {
        CompiladorJrxml real = new CompiladorJrxml();
        return (fonte) -> {
            contador.incrementAndGet();
            return real.compilar(fonte);
        };
    }

    @Test
    void segundaInstanciaReaproveitaDoRedisSemRecompilar_eHitL1NaoDependeDoRedis() {
        String jrxml = jrxmlUnico();
        AtomicInteger compilacoes = new AtomicInteger();
        var compilador = compiladorContando(compilacoes);

        var instanciaA = new CacheDeCompilacaoCompartilhado(factory, "reportlenz:compile:test:", 1);
        JasperReport deA = instanciaA.obterOuCompilar(jrxml, compilador);
        assertThat(deA).isNotNull();
        assertThat(compilacoes.get()).isEqualTo(1);

        // Instância B (outro processo, na prática): pega os bytes do Redis — SEM recompilar.
        var instanciaB = new CacheDeCompilacaoCompartilhado(factory, "reportlenz:compile:test:", 1);
        JasperReport deB = instanciaB.obterOuCompilar(jrxml, compilador);
        assertThat(compilacoes.get()).isEqualTo(1);
        assertThat(deB.getName()).isEqualTo(deA.getName());

        // Hit L1: mesmo com a chave APAGADA do Redis, a instância A responde local.
        String hash = CacheDeCompilacaoEmMemoria.sha256(jrxml);
        try (var conexao = factory.getConnection()) {
            conexao.keyCommands().del(("reportlenz:compile:test:" + hash).getBytes());
        }
        assertThat(instanciaA.obterOuCompilar(jrxml, compilador)).isNotNull();
        assertThat(compilacoes.get()).isEqualTo(1);
    }

    @Test
    void redisForaDoArDegradaParaCompilacaoLocalSemFalhar() {
        RedisConnectionFactory quebrada = mock(RedisConnectionFactory.class);
        when(quebrada.getConnection()).thenThrow(new IllegalStateException("redis fora do ar"));

        AtomicInteger compilacoes = new AtomicInteger();
        var cache = new CacheDeCompilacaoCompartilhado(quebrada, "reportlenz:compile:test:", 1);

        String jrxml = jrxmlUnico();
        assertThat(cache.obterOuCompilar(jrxml, compiladorContando(compilacoes))).isNotNull();
        assertThat(compilacoes.get()).isEqualTo(1);
        // E o L1 continua valendo mesmo sem Redis.
        assertThat(cache.obterOuCompilar(jrxml, compiladorContando(compilacoes))).isNotNull();
        assertThat(compilacoes.get()).isEqualTo(1);
    }
}
