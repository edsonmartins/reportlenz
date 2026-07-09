package dev.reportlenz.render.batch;

import java.time.Duration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * Fila do batch sobre Redis (decisão do usuário, 2026-07-09): LPUSH para
 * enfileirar, BRPOP (rightPop bloqueante) para consumir. O Redis é só o
 * TRANSPORTE — o estado durável do job vive no SQLite (RepositorioDeJobs),
 * então um jobId perdido entre pop e processamento pode ser reenfileirado
 * sem duplicar saídas (idempotência por item).
 */
@Component
public class FilaDeRender {

    private final StringRedisTemplate redis;
    private final String nomeFila;

    public FilaDeRender(StringRedisTemplate redis, @Value("${reportlenz.fila.nome}") String nomeFila) {
        this.redis = redis;
        this.nomeFila = nomeFila;
    }

    public void enfileirar(String jobId) {
        redis.opsForList().leftPush(nomeFila, jobId);
    }

    /** Bloqueia até `timeout` esperando um jobId; null se a fila ficou vazia. */
    public String aguardar(Duration timeout) {
        return redis.opsForList().rightPop(nomeFila, timeout);
    }
}
