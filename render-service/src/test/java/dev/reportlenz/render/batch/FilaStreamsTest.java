package dev.reportlenz.render.batch;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import java.time.Duration;
import java.util.UUID;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;

/**
 * Fila com Redis Streams (change fila-redis-streams, tarefas 1.1-1.3):
 * at-least-once — mensagem só sai com ACK pós-processamento; worker morto
 * deixa pendente que OUTRA instância reivindica; contagem de entregas
 * alimenta o poison cap do worker.
 *
 * Requer Redis acessível (local em dev; service container no CI).
 */
class FilaStreamsTest {

    private static LettuceConnectionFactory factory;
    private static StringRedisTemplate redis;

    @BeforeAll
    static void abrirRedis() {
        factory = new LettuceConnectionFactory("localhost", 6379);
        factory.afterPropertiesSet();
        factory.start();
        redis = new StringRedisTemplate(factory);
        redis.afterPropertiesSet();
    }

    @AfterAll
    static void fecharRedis() {
        factory.destroy();
    }

    private static FilaDeRender novaInstancia(String stream, long reivindicarAposSegundos) {
        FilaDeRender fila = new FilaDeRender(redis, stream, reivindicarAposSegundos);
        fila.garantirGrupo();
        return fila;
    }

    private static String streamUnico() {
        return "reportlenz:render:fila:streams-test:" + UUID.randomUUID();
    }

    @Test
    void fluxoNormal_consumirConfirmarEsvaziaAFila() {
        String stream = streamUnico();
        FilaDeRender fila = novaInstancia(stream, 60);

        fila.enfileirar("job-1");
        FilaDeRender.Mensagem mensagem = fila.aguardar(Duration.ofSeconds(2));
        assertThat(mensagem).isNotNull();
        assertThat(mensagem.jobId()).isEqualTo("job-1");
        assertThat(mensagem.entregas()).isEqualTo(1);

        fila.confirmar(mensagem.recordId());
        assertThat(fila.aguardar(Duration.ofMillis(200))).isNull(); // nada pendente, nada novo
    }

    @Test
    void workerMorto_outraInstanciaReivindicaEEntregasCresce() {
        String stream = streamUnico();
        FilaDeRender instanciaA = novaInstancia(stream, 1);
        FilaDeRender instanciaB = novaInstancia(stream, 1);

        instanciaA.enfileirar("job-orfao");
        FilaDeRender.Mensagem lidaPorA = instanciaA.aguardar(Duration.ofSeconds(2));
        assertThat(lidaPorA.jobId()).isEqualTo("job-orfao");
        // A "morre" sem confirmar. Antes do idle, B NÃO rouba a mensagem.
        assertThat(instanciaB.aguardar(Duration.ofMillis(200))).isNull();

        // Depois do idle (1s), B reivindica a MESMA mensagem — entrega nº 2.
        await().atMost(Duration.ofSeconds(5)).untilAsserted(() -> {
            FilaDeRender.Mensagem reivindicada = instanciaB.aguardar(Duration.ofMillis(200));
            assertThat(reivindicada).isNotNull();
            assertThat(reivindicada.jobId()).isEqualTo("job-orfao");
            assertThat(reivindicada.entregas()).isGreaterThanOrEqualTo(2);
            instanciaB.confirmar(reivindicada.recordId());
        });
        assertThat(instanciaB.aguardar(Duration.ofMillis(200))).isNull();
    }

    @Test
    void reentregasSucessivasEscalamContagem_paraOPoisonCap() throws Exception {
        String stream = streamUnico();
        FilaDeRender fila = novaInstancia(stream, 1);

        fila.enfileirar("job-veneno");
        long entregas = 0;
        // Consome sem nunca confirmar: a própria instância re-reivindica a
        // pendente a cada volta e a contagem de entregas cresce — é ela que o
        // worker compara com MAX_ENTREGAS para marcar failed e confirmar.
        for (int volta = 0; volta < 3; volta++) {
            FilaDeRender.Mensagem mensagem = fila.aguardar(Duration.ofSeconds(2));
            assertThat(mensagem).isNotNull();
            assertThat(mensagem.jobId()).isEqualTo("job-veneno");
            entregas = mensagem.entregas();
        }
        assertThat(entregas).isGreaterThanOrEqualTo(3);
    }
}
