package dev.reportlenz.render.storage;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Configuração do storage de saídas do batch — padrão MEDIASTORE do
 * integrall-commerce-api (decisão do usuário, 2026-07-09): provider LOCAL
 * (arquivos) para começar; o ramo MINIO (S3 path-style, bucket auto-criado)
 * entra na tarefa 5.4 com a mesma estrutura.
 */
@ConfigurationProperties(prefix = "reportlenz.storage")
public class ArmazenamentoProperties {

    public enum Provider {
        LOCAL,
        MINIO
    }

    private Provider provider = Provider.LOCAL;
    private String localPath = "data/saidas";
    /** URL base pública para compor links externos (vazio → caminho local). */
    private String publicBaseUrl = "";
    private Minio minio = new Minio();

    public static class Minio {
        private String endpoint = "http://localhost:9000";
        private String accessKey = "";
        private String secretKey = "";
        private String bucket = "reportlenz-saidas";
        private String region = "us-east-1";
        /** Aceita certificado TLS inválido (MinIO self-signed na rede interna). */
        private boolean insecureTls = false;

        public String getEndpoint() { return endpoint; }
        public void setEndpoint(String endpoint) { this.endpoint = endpoint; }
        public String getAccessKey() { return accessKey; }
        public void setAccessKey(String accessKey) { this.accessKey = accessKey; }
        public String getSecretKey() { return secretKey; }
        public void setSecretKey(String secretKey) { this.secretKey = secretKey; }
        public String getBucket() { return bucket; }
        public void setBucket(String bucket) { this.bucket = bucket; }
        public String getRegion() { return region; }
        public void setRegion(String region) { this.region = region; }
        public boolean isInsecureTls() { return insecureTls; }
        public void setInsecureTls(boolean insecureTls) { this.insecureTls = insecureTls; }
    }

    public Provider getProvider() { return provider; }
    public void setProvider(Provider provider) { this.provider = provider; }
    public String getLocalPath() { return localPath; }
    public void setLocalPath(String localPath) { this.localPath = localPath; }
    public String getPublicBaseUrl() { return publicBaseUrl; }
    public void setPublicBaseUrl(String publicBaseUrl) { this.publicBaseUrl = publicBaseUrl; }
    public Minio getMinio() { return minio; }
    public void setMinio(Minio minio) { this.minio = minio; }
}
