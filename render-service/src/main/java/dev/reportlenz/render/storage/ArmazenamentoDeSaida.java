package dev.reportlenz.render.storage;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;

/**
 * Storage de saídas do batch (RFC-003 §4 — tarefa 5.4 parcial), no padrão
 * MEDIASTORE: um serviço com switch de provider. LOCAL grava em
 * `{localPath}/{jobId}/{arquivo}` e devolve a referência (publicBaseUrl
 * quando configurada); o ramo MINIO chega na 5.4.
 */
@Service
public class ArmazenamentoDeSaida {

    private static final Logger log = LoggerFactory.getLogger(ArmazenamentoDeSaida.class);

    private final ArmazenamentoProperties properties;
    private Path raizLocal;

    public ArmazenamentoDeSaida(ArmazenamentoProperties properties) {
        this.properties = properties;
    }

    @PostConstruct
    void iniciar() {
        log.info("[STORAGE] provider={}, localPath={}", properties.getProvider(), properties.getLocalPath());
        if (properties.getProvider() == ArmazenamentoProperties.Provider.MINIO) {
            // Tarefa 5.4: cliente S3 path-style + bucket auto-criado (padrão MEDIASTORE).
            log.warn("[STORAGE] provider MINIO ainda não implementado (tarefa 5.4) — usando LOCAL");
        }
        try {
            raizLocal = Paths.get(properties.getLocalPath());
            Files.createDirectories(raizLocal);
        } catch (IOException e) {
            throw new UncheckedIOException("não foi possível preparar o diretório de saídas: " + properties.getLocalPath(), e);
        }
    }

    /** Grava a saída de um item do lote e devolve a referência (link/caminho). */
    public String salvar(String jobId, String nomeArquivo, byte[] conteudo) {
        String nome = sanitizar(nomeArquivo);
        try {
            Path dir = raizLocal.resolve(sanitizar(jobId));
            Files.createDirectories(dir);
            Path arquivo = dir.resolve(nome);
            Files.write(arquivo, conteudo);
            String base = properties.getPublicBaseUrl();
            return base == null || base.isBlank()
                    ? arquivo.toAbsolutePath().toString()
                    : base.replaceAll("/+$", "") + "/" + jobId + "/" + nome;
        } catch (IOException e) {
            throw new UncheckedIOException("falha ao gravar saída " + nome + " do job " + jobId, e);
        }
    }

    private String sanitizar(String nome) {
        return nome.replaceAll("[^A-Za-z0-9._-]", "_");
    }
}
