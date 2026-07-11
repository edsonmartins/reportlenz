package dev.reportlenz.render.pipeline;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Function;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Primary;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.stereotype.Component;

import net.sf.jasperreports.engine.JasperReport;
import net.sf.jasperreports.engine.util.JRLoader;
import net.sf.jasperreports.engine.util.JRSaver;

/**
 * Compile cache COMPARTILHADO (change cache-compilacao-redis; previsto no
 * ADR-008 e pendente desde a nota-005): dois níveis atrás da mesma interface —
 * L1 in-memory LRU por instância (hit local não toca a rede) e L2 Redis com os
 * bytes do `.jasper` serializado (`JRSaver`/`JRLoader`).
 *
 * A chave é `sha256(jrxml)` = `jrxml_hash` (ADR-009): conteúdo imutável por
 * construção — nunca há entrada obsoleta, o TTL só limita memória do Redis.
 * Redis indisponível DEGRADA para compilar localmente: render nunca falha por
 * causa do cache (o span `render.compilacao` segue contando só compile real).
 */
@Component
@Primary
@ConditionalOnProperty(name = "reportlenz.compile-cache.compartilhado", havingValue = "true", matchIfMissing = true)
public class CacheDeCompilacaoCompartilhado implements CacheDeCompilacao {

    private static final Logger log = LoggerFactory.getLogger(CacheDeCompilacaoCompartilhado.class);
    private static final int MAX_ENTRADAS_L1 = 200;

    private final RedisConnectionFactory redis;
    private final String prefixo;
    private final Duration ttl;

    private final Map<String, JasperReport> l1 = new LinkedHashMap<>(64, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, JasperReport> eldest) {
            return size() > MAX_ENTRADAS_L1;
        }
    };

    public CacheDeCompilacaoCompartilhado(
            RedisConnectionFactory redis,
            @Value("${reportlenz.compile-cache.prefixo:reportlenz:compile:}") String prefixo,
            @Value("${reportlenz.compile-cache.ttl-horas:24}") long ttlHoras) {
        this.redis = redis;
        this.prefixo = prefixo;
        this.ttl = Duration.ofHours(ttlHoras);
    }

    @Override
    public synchronized JasperReport obterOuCompilar(String jrxml, Function<String, JasperReport> compilacao) {
        String hash = CacheDeCompilacaoEmMemoria.sha256(jrxml);

        JasperReport noL1 = l1.get(hash);
        if (noL1 != null) {
            return noL1;
        }

        JasperReport doRedis = lerDoRedis(hash);
        if (doRedis != null) {
            l1.put(hash, doRedis);
            return doRedis;
        }

        JasperReport compilado = compilacao.apply(jrxml);
        l1.put(hash, compilado);
        gravarNoRedis(hash, compilado);
        return compilado;
    }

    private byte[] chave(String hash) {
        return (prefixo + hash).getBytes(StandardCharsets.UTF_8);
    }

    private JasperReport lerDoRedis(String hash) {
        try (var conexao = redis.getConnection()) {
            byte[] bytes = conexao.stringCommands().get(chave(hash));
            if (bytes == null) {
                return null;
            }
            return (JasperReport) JRLoader.loadObject(new ByteArrayInputStream(bytes));
        } catch (Exception e) {
            log.warn("[CACHE] L2 Redis indisponível na leitura ({}); compilando localmente", e.getMessage());
            return null;
        }
    }

    private void gravarNoRedis(String hash, JasperReport compilado) {
        try (var conexao = redis.getConnection()) {
            ByteArrayOutputStream saida = new ByteArrayOutputStream();
            JRSaver.saveObject(compilado, saida);
            conexao.stringCommands().setEx(chave(hash), ttl.toSeconds(), saida.toByteArray());
        } catch (Exception e) {
            log.warn("[CACHE] L2 Redis indisponível na escrita ({}); seguindo só com L1", e.getMessage());
        }
    }
}
