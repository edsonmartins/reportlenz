package dev.reportlenz.render.config;

import org.springframework.beans.factory.InitializingBean;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.stereotype.Component;

/**
 * Scenario "Infraestrutura ausente" (ADR-026 §3): com o batch habilitado
 * (default), o boot FALHA com mensagem que diz o que configurar — nunca um
 * modo silencioso em que o lote nunca roda.
 */
@Component
@RecursoBatch
public class VerificacaoDoBatch implements InitializingBean {

    private final RedisConnectionFactory redis;
    private final boolean registroHabilitado;

    public VerificacaoDoBatch(RedisConnectionFactory redis,
            @Value("${reportlenz.registro.habilitado:true}") boolean registroHabilitado) {
        this.redis = redis;
        this.registroHabilitado = registroHabilitado;
    }

    @Override
    public void afterPropertiesSet() {
        if (!registroHabilitado) {
            throw new IllegalStateException("reportlenz.batch.habilitado=true exige o registro de templates "
                    + "(o lote só roda template PUBLICADO — ADR-016): ligue reportlenz.registro.habilitado "
                    + "ou desligue reportlenz.batch.habilitado=false.");
        }
        try (var conexao = redis.getConnection()) {
            conexao.ping();
        } catch (RuntimeException e) {
            throw new IllegalStateException("Batch do ReportLenz habilitado, mas o Redis não responde ("
                    + e.getMessage() + "). Configure spring.data.redis.host/port/password (ou REDIS_HOST/REDIS_PORT) "
                    + "ou desligue o batch com reportlenz.batch.habilitado=false (ADR-026).", e);
        }
    }
}
