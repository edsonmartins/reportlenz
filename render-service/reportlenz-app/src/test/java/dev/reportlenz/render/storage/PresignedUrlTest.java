package dev.reportlenz.render.storage;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

/**
 * Presigned URLs (change presigned-urls-minio, tarefas 1.1-1.3): assinar é
 * operação LOCAL — o presigner funciona mesmo com o MinIO fora do ar; a
 * referência persistida (`s3://...`) vira URL assinada NA CONSULTA; LOCAL e
 * presign desligado passam intactos.
 */
class PresignedUrlTest {

    private static ArmazenamentoDeSaida storageMinio(String endpoint, long presignHoras) {
        var props = new ArmazenamentoProperties();
        props.setProvider(ArmazenamentoProperties.Provider.MINIO);
        props.setLocalPath("target/test-saidas-presign");
        props.getMinio().setEndpoint(endpoint);
        props.getMinio().setAccessKey("teste");
        props.getMinio().setSecretKey("teste-secreto");
        props.getMinio().setPresignHoras(presignHoras);
        var storage = new ArmazenamentoDeSaida(props);
        storage.iniciar(); // headBucket falha (endpoint morto) → fallback LOCAL; presigner sobrevive
        return storage;
    }

    @Test
    void referenciaS3ViraUrlAssinadaPathStyleComExpiracao_mesmoComMinioForaDoAr() {
        var storage = storageMinio("http://127.0.0.1:1", 24);
        String url = storage.linkDeDownload("s3://reportlenz-saidas/job-42/comprovante_0.pdf");

        assertThat(url).startsWith("http://127.0.0.1:1/reportlenz-saidas/job-42/comprovante_0.pdf"); // path-style
        assertThat(url).contains("X-Amz-Signature=");
        assertThat(url).contains("X-Amz-Expires=86400"); // 24h
        assertThat(url).contains("X-Amz-Credential=teste");

        // Consulta repetida → assinatura fresca (timestamps podem coincidir; a URL é sempre gerada agora).
        assertThat(storage.linkDeDownload("s3://reportlenz-saidas/job-42/comprovante_0.pdf"))
                .contains("X-Amz-Signature=");
    }

    @Test
    void passthrough_localPresignDesligadoEReferenciasNaoS3() {
        // presign-horas: 0 desliga — referência s3:// passa crua.
        var desligado = storageMinio("http://127.0.0.1:1", 0);
        assertThat(desligado.linkDeDownload("s3://bucket/x.pdf")).isEqualTo("s3://bucket/x.pdf");

        // Provider LOCAL: caminho/publicBaseUrl passam intactos.
        var propsLocal = new ArmazenamentoProperties();
        propsLocal.setLocalPath("target/test-saidas-presign");
        var local = new ArmazenamentoDeSaida(propsLocal);
        local.iniciar();
        assertThat(local.linkDeDownload("/abs/caminho/doc.pdf")).isEqualTo("/abs/caminho/doc.pdf");
        assertThat(local.linkDeDownload("https://cdn.exemplo/j/doc.pdf")).isEqualTo("https://cdn.exemplo/j/doc.pdf");
        assertThat(local.linkDeDownload(null)).isNull();
    }

    /**
     * Validação REAL (opt-in, mesma trava do ArmazenamentoDeSaidaTest):
     * export $(grep -E '^MINIO_' ~/.env-projetos/reportlenz/.env | xargs) && mvn test -Dtest=PresignedUrlTest
     * Sobe um objeto no MinIO da infra, presigna e BAIXA pela URL assinada.
     */
    @Test
    @EnabledIfEnvironmentVariable(named = "MINIO_ENDPOINT", matches = ".+")
    void urlAssinadaBaixaOConteudoDoMinioReal() throws Exception {
        var props = new ArmazenamentoProperties();
        props.setProvider(ArmazenamentoProperties.Provider.MINIO);
        props.setLocalPath("target/test-saidas-presign");
        props.getMinio().setEndpoint(System.getenv("MINIO_ENDPOINT"));
        props.getMinio().setAccessKey(System.getenv("MINIO_ACCESS_KEY"));
        props.getMinio().setSecretKey(System.getenv("MINIO_SECRET_KEY"));
        props.getMinio().setInsecureTls(Boolean.parseBoolean(System.getenv().getOrDefault("MINIO_INSECURE_TLS", "false")));
        var storage = new ArmazenamentoDeSaida(props);
        storage.iniciar();

        byte[] conteudo = "presign-ok".getBytes();
        String referencia = storage.salvar("job-presign", "prova.txt", conteudo);
        assertThat(referencia).startsWith("s3://");

        String url = storage.linkDeDownload(referencia);
        assertThat(url).contains("X-Amz-Signature=");

        HttpClient http = props.getMinio().isInsecureTls() ? httpInseguro() : HttpClient.newHttpClient();
        HttpResponse<byte[]> resposta = http.send(
                HttpRequest.newBuilder(java.net.URI.create(url)).GET().build(),
                HttpResponse.BodyHandlers.ofByteArray());
        assertThat(resposta.statusCode()).isEqualTo(200);
        assertThat(resposta.body()).isEqualTo(conteudo);
    }

    private static HttpClient httpInseguro() throws Exception {
        // MinIO self-signed sem SAN: além do trust-all, o java.net.http exige
        // desligar a verificação de hostname por system property.
        System.setProperty("jdk.internal.httpclient.disableHostnameVerification", "true");
        var ssl = javax.net.ssl.SSLContext.getInstance("TLS");
        var confiaEmTudo = new javax.net.ssl.X509TrustManager() {
            @Override public void checkClientTrusted(java.security.cert.X509Certificate[] c, String a) {}
            @Override public void checkServerTrusted(java.security.cert.X509Certificate[] c, String a) {}
            @Override public java.security.cert.X509Certificate[] getAcceptedIssuers() { return new java.security.cert.X509Certificate[0]; }
        };
        ssl.init(null, new javax.net.ssl.TrustManager[] { confiaEmTudo }, new java.security.SecureRandom());
        return HttpClient.newBuilder().sslContext(ssl).build();
    }
}
