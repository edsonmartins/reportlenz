package dev.reportlenz.render.batch;

import java.net.InetAddress;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Range;
import org.springframework.data.redis.connection.stream.Consumer;
import org.springframework.data.redis.connection.stream.MapRecord;
import org.springframework.data.redis.connection.stream.ReadOffset;
import org.springframework.data.redis.connection.stream.RecordId;
import org.springframework.data.redis.connection.stream.StreamOffset;
import org.springframework.data.redis.connection.stream.StreamReadOptions;
import org.springframework.data.redis.connection.stream.StreamRecords;
import org.springframework.data.redis.core.StreamOperations;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;

/**
 * Fila do batch sobre **Redis Streams + consumer group** (change
 * fila-redis-streams — at-least-once, último item de infra da nota-005):
 *
 * - XADD enfileira; XREADGROUP consome (consumidor único por instância);
 * - a mensagem SÓ sai da fila com {@link #confirmar} (XACK) — worker que
 *   morre com job em mãos a deixa PENDENTE;
 * - {@link #aguardar} primeiro REIVINDICA pendentes órfãs (XPENDING/XCLAIM,
 *   idle > `reivindicar-apos-segundos`) de consumidores mortos, depois lê
 *   mensagens novas; a contagem de entregas viaja na {@link Mensagem} para o
 *   poison cap do worker.
 *
 * O Redis segue sendo só TRANSPORTE — o estado durável vive no banco;
 * reprocessar não duplica saídas (PK job_id+idx).
 */
@Component
public class FilaDeRender {

    private static final Logger log = LoggerFactory.getLogger(FilaDeRender.class);
    private static final String GRUPO = "reportlenz-render";
    private static final String CAMPO_JOB = "job";

    /** Mensagem consumida: {@code confirmar(recordId)} SÓ depois de processar. */
    public record Mensagem(String jobId, String recordId, long entregas) {}

    private final StringRedisTemplate redis;
    private final String stream;
    private final Duration reivindicarApos;
    private final String consumidor;

    public FilaDeRender(StringRedisTemplate redis,
            @Value("${reportlenz.fila.nome}") String stream,
            @Value("${reportlenz.fila.reivindicar-apos-segundos:60}") long reivindicarAposSegundos) {
        this.redis = redis;
        this.stream = stream;
        this.reivindicarApos = Duration.ofSeconds(reivindicarAposSegundos);
        this.consumidor = nomeDoConsumidor();
    }

    private static String nomeDoConsumidor() {
        String host;
        try {
            host = InetAddress.getLocalHost().getHostName();
        } catch (Exception e) {
            host = "instancia";
        }
        return host + "-" + UUID.randomUUID().toString().substring(0, 8);
    }

    @PostConstruct
    void garantirGrupo() {
        try {
            redis.opsForStream().createGroup(stream, ReadOffset.from("0"), GRUPO);
        } catch (Exception e) {
            // BUSYGROUP = grupo já existe (outra instância criou) — idempotente.
            if (e.getMessage() == null || !e.getMessage().contains("BUSYGROUP")) {
                log.warn("[FILA] criação do grupo adiada ({})", e.getMessage());
            }
        }
    }

    public void enfileirar(String jobId) {
        redis.opsForStream().add(StreamRecords.newRecord()
                .in(stream)
                .ofMap(Map.of(CAMPO_JOB, jobId)));
    }

    /**
     * Próxima mensagem: pendente órfã reivindicada (prioridade — recuperação
     * de worker morto) ou mensagem nova (bloqueia até `timeout`). Null se nada.
     */
    public Mensagem aguardar(Duration timeout) {
        Mensagem orfa = reivindicarOrfa();
        if (orfa != null) {
            return orfa;
        }
        List<MapRecord<String, Object, Object>> novas = ops().read(
                Consumer.from(GRUPO, consumidor),
                StreamReadOptions.empty().count(1).block(timeout),
                StreamOffset.create(stream, ReadOffset.lastConsumed()));
        if (novas == null || novas.isEmpty()) {
            return null;
        }
        MapRecord<String, Object, Object> registro = novas.get(0);
        return new Mensagem(String.valueOf(registro.getValue().get(CAMPO_JOB)), registro.getId().getValue(), 1);
    }

    private Mensagem reivindicarOrfa() {
        try {
            var pendentes = ops().pending(stream, GRUPO, Range.unbounded(), 10);
            if (pendentes == null) {
                return null;
            }
            for (var pendente : pendentes) {
                boolean ociosa = pendente.getElapsedTimeSinceLastDelivery().compareTo(reivindicarApos) >= 0;
                boolean minha = consumidor.equals(pendente.getConsumerName());
                if (!ociosa && !minha) {
                    continue; // dona ainda pode estar viva
                }
                List<MapRecord<String, Object, Object>> reclamadas =
                        ops().claim(stream, GRUPO, consumidor, minha ? Duration.ZERO : reivindicarApos,
                                RecordId.of(pendente.getIdAsString()));
                if (!reclamadas.isEmpty()) {
                    MapRecord<String, Object, Object> registro = reclamadas.get(0);
                    log.info("[FILA] mensagem {} reivindicada de '{}' (entrega nº {})",
                            registro.getId().getValue(), pendente.getConsumerName(), pendente.getTotalDeliveryCount() + 1);
                    return new Mensagem(String.valueOf(registro.getValue().get(CAMPO_JOB)),
                            registro.getId().getValue(), pendente.getTotalDeliveryCount() + 1);
                }
            }
        } catch (Exception e) {
            log.warn("[FILA] varredura de pendentes falhou: {}", e.getMessage());
        }
        return null;
    }

    /** Confirma (XACK) e remove do stream — chamar SÓ depois de processar. */
    public void confirmar(String recordId) {
        ops().acknowledge(stream, GRUPO, recordId);
        redis.opsForStream().delete(stream, RecordId.of(recordId));
    }

    private StreamOperations<String, Object, Object> ops() {
        return redis.opsForStream();
    }
}
