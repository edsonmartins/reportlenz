package dev.reportlenz.render.storage;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.http.SdkHttpConfigurationOption;
import software.amazon.awssdk.http.apache.ApacheHttpClient;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.CreateBucketRequest;
import software.amazon.awssdk.services.s3.model.HeadBucketRequest;
import software.amazon.awssdk.services.s3.model.NoSuchBucketException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.utils.AttributeMap;

/**
 * Storage de saídas do batch (RFC-003 §4, tarefa 5.4), no padrão MEDIASTORE
 * do integrall-commerce-api: um serviço com switch de provider.
 *
 * - LOCAL: grava em `{localPath}/{jobId}/{arquivo}`;
 * - MINIO: S3-compatível com path-style, bucket auto-criado e TLS relaxado
 *   opcional (`insecure-tls`, para o MinIO self-signed da rede interna);
 *   falha de init/upload cai para LOCAL — durabilidade acima de pureza,
 *   como no padrão de origem.
 *
 * Referência devolvida: `publicBaseUrl/{jobId}/{arquivo}` quando configurada;
 * senão `s3://bucket/chave` (MINIO) ou caminho absoluto (LOCAL).
 */
@Service
public class ArmazenamentoDeSaida {

    private static final Logger log = LoggerFactory.getLogger(ArmazenamentoDeSaida.class);

    private final ArmazenamentoProperties properties;
    private Path raizLocal;
    private S3Client s3;

    public ArmazenamentoDeSaida(ArmazenamentoProperties properties) {
        this.properties = properties;
    }

    @PostConstruct
    void iniciar() {
        log.info("[STORAGE] provider={}, localPath={}", properties.getProvider(), properties.getLocalPath());
        if (properties.getProvider() == ArmazenamentoProperties.Provider.MINIO) {
            iniciarMinio();
        }
        try {
            raizLocal = Paths.get(properties.getLocalPath());
            Files.createDirectories(raizLocal);
        } catch (IOException e) {
            throw new UncheckedIOException("não foi possível preparar o diretório de saídas: " + properties.getLocalPath(), e);
        }
    }

    private void iniciarMinio() {
        var minio = properties.getMinio();
        log.info("[STORAGE] Inicializando MinIO — endpoint={}, bucket={}, insecureTls={}",
                minio.getEndpoint(), minio.getBucket(), minio.isInsecureTls());
        try {
            var http = minio.isInsecureTls()
                    ? ApacheHttpClient.builder().buildWithDefaults(AttributeMap.builder()
                            .put(SdkHttpConfigurationOption.TRUST_ALL_CERTIFICATES, Boolean.TRUE)
                            .build())
                    : ApacheHttpClient.builder().build();

            s3 = S3Client.builder()
                    .endpointOverride(URI.create(minio.getEndpoint()))
                    .region(Region.of(minio.getRegion()))
                    .credentialsProvider(StaticCredentialsProvider.create(
                            AwsBasicCredentials.create(minio.getAccessKey(), minio.getSecretKey())))
                    .forcePathStyle(true)
                    .httpClient(http)
                    .build();

            garantirBucket(minio.getBucket());
            log.info("[STORAGE] MinIO inicializado com sucesso — bucket={}", minio.getBucket());
        } catch (Exception e) {
            log.error("[STORAGE] FALHA ao configurar MinIO ({}). Fallback para LOCAL. Erro: {}",
                    minio.getEndpoint(), e.getMessage());
            s3 = null;
        }
    }

    private void garantirBucket(String bucket) {
        try {
            s3.headBucket(HeadBucketRequest.builder().bucket(bucket).build());
        } catch (NoSuchBucketException e) {
            log.info("[STORAGE] bucket '{}' não existe, criando...", bucket);
            s3.createBucket(CreateBucketRequest.builder().bucket(bucket).build());
        }
    }

    @PreDestroy
    void encerrar() {
        if (s3 != null) {
            s3.close();
        }
    }

    /** Grava a saída de um item do lote e devolve a referência (link/caminho). */
    public String salvar(String jobId, String nomeArquivo, byte[] conteudo) {
        String job = sanitizar(jobId);
        String nome = sanitizar(nomeArquivo);

        if (s3 != null) {
            String chave = job + "/" + nome;
            try {
                s3.putObject(PutObjectRequest.builder()
                                .bucket(properties.getMinio().getBucket())
                                .key(chave)
                                .contentType("application/pdf")
                                .build(),
                        RequestBody.fromBytes(conteudo));
                return referenciaExterna(job, nome, "s3://" + properties.getMinio().getBucket() + "/" + chave);
            } catch (Exception e) {
                log.error("[STORAGE] falha no upload MinIO de {} — fallback LOCAL: {}", chave, e.getMessage());
            }
        }

        return salvarLocal(job, nome, conteudo);
    }

    private String salvarLocal(String job, String nome, byte[] conteudo) {
        try {
            Path dir = raizLocal.resolve(job);
            Files.createDirectories(dir);
            Path arquivo = dir.resolve(nome);
            Files.write(arquivo, conteudo);
            return referenciaExterna(job, nome, arquivo.toAbsolutePath().toString());
        } catch (IOException e) {
            throw new UncheckedIOException("falha ao gravar saída " + nome + " do job " + job, e);
        }
    }

    private String referenciaExterna(String job, String nome, String padrao) {
        String base = properties.getPublicBaseUrl();
        return base == null || base.isBlank()
                ? padrao
                : base.replaceAll("/+$", "") + "/" + job + "/" + nome;
    }

    private String sanitizar(String nome) {
        return nome.replaceAll("[^A-Za-z0-9._-]", "_");
    }
}
