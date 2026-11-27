package dev.reportlenz.render.pipeline;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Function;

import org.springframework.stereotype.Component;

import net.sf.jasperreports.engine.JasperReport;

/**
 * Implementação em memória do compile cache (RFC-003 §3: "Redis/in-memory").
 *
 * LRU com teto de entradas, por instância. Suficiente para o preview do
 * designer em instância única; o store Redis compartilhado (ADR-008) entra
 * junto com a infraestrutura do batch (tarefas 5.x), atrás desta mesma
 * interface — o valor lá serão os bytes do `.jasper` serializado.
 */
@Component
public class CacheDeCompilacaoEmMemoria implements CacheDeCompilacao {

    private static final int MAX_ENTRADAS = 200;

    private final Map<String, JasperReport> lru = new LinkedHashMap<>(64, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, JasperReport> eldest) {
            return size() > MAX_ENTRADAS;
        }
    };

    @Override
    public synchronized JasperReport obterOuCompilar(String jrxml, Function<String, JasperReport> compilacao) {
        String chave = sha256(jrxml);
        JasperReport existente = lru.get(chave);
        if (existente != null) {
            return existente;
        }
        JasperReport compilado = compilacao.apply(jrxml);
        lru.put(chave, compilado);
        return compilado;
    }

    /** Chave do cache = sha256(jrxml) — a mesma do `jrxml_hash` (ADR-009). */
    static String sha256(String jrxml) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(jrxml.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 indisponível na JVM", e);
        }
    }
}
