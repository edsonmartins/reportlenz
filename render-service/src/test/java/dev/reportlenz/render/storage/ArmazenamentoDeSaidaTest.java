package dev.reportlenz.render.storage;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

/**
 * Tarefa phase-1/5.4 — storage MEDIASTORE com ramo MINIO.
 *
 * O teste de integração real roda apenas quando MINIO_ENDPOINT está no
 * ambiente (infra do usuário; credenciais nunca entram no repositório):
 *   export $(grep -E '^MINIO_' ~/.env-projetos/gestor-rq/.env | xargs) && mvn test
 */
class ArmazenamentoDeSaidaTest {

    private ArmazenamentoProperties propriedadesLocais(String dir) {
        var p = new ArmazenamentoProperties();
        p.setProvider(ArmazenamentoProperties.Provider.LOCAL);
        p.setLocalPath(dir);
        return p;
    }

    @Test
    void localGravaEDevolveCaminhoAbsoluto() throws Exception {
        var storage = new ArmazenamentoDeSaida(propriedadesLocais("target/test-storage-local"));
        storage.iniciar();

        String ref = storage.salvar("job-1", "0.pdf", "%PDF-fake".getBytes());
        assertThat(ref).endsWith("job-1/0.pdf");
        assertThat(Files.readString(Path.of(ref))).isEqualTo("%PDF-fake");
    }

    @Test
    void publicBaseUrlComposLinkExterno() {
        var p = propriedadesLocais("target/test-storage-local");
        p.setPublicBaseUrl("https://render.rioquality.com.br/saidas/");
        var storage = new ArmazenamentoDeSaida(p);
        storage.iniciar();

        String ref = storage.salvar("job-2", "1.pdf", "x".getBytes());
        assertThat(ref).isEqualTo("https://render.rioquality.com.br/saidas/job-2/1.pdf");
    }

    @Test
    void minioInalcancavelCaiParaLocalSemQuebrarOLote() {
        var p = propriedadesLocais("target/test-storage-fallback");
        p.setProvider(ArmazenamentoProperties.Provider.MINIO);
        p.getMinio().setEndpoint("https://127.0.0.1:1"); // porta fechada
        p.getMinio().setAccessKey("x");
        p.getMinio().setSecretKey("x");
        var storage = new ArmazenamentoDeSaida(p);
        storage.iniciar(); // não lança — loga e cai para LOCAL (padrão MEDIASTORE)

        String ref = storage.salvar("job-3", "0.pdf", "conteudo".getBytes());
        assertThat(ref).contains("test-storage-fallback");
        assertThat(Files.exists(Path.of(ref))).isTrue();
    }

    @Test
    @EnabledIfEnvironmentVariable(named = "MINIO_ENDPOINT", matches = ".+")
    void integracaoReal_uploadNoMinioDaInfra() {
        var p = new ArmazenamentoProperties();
        p.setProvider(ArmazenamentoProperties.Provider.MINIO);
        p.setLocalPath("target/test-storage-minio-fallback");
        p.getMinio().setEndpoint(System.getenv("MINIO_ENDPOINT"));
        p.getMinio().setAccessKey(System.getenv("MINIO_ACCESS_KEY"));
        p.getMinio().setSecretKey(System.getenv("MINIO_SECRET_KEY"));
        p.getMinio().setBucket(System.getenv().getOrDefault("MINIO_BUCKET_REPORTLENZ", "reportlenz-saidas"));
        p.getMinio().setInsecureTls("true".equalsIgnoreCase(System.getenv().getOrDefault("MINIO_INSECURE_TLS", "false")));

        var storage = new ArmazenamentoDeSaida(p);
        storage.iniciar();

        String job = "it-" + UUID.randomUUID();
        String ref = storage.salvar(job, "0.pdf", "%PDF-integracao".getBytes());

        // Upload real: a referência é do bucket, não fallback local.
        assertThat(ref).startsWith("s3://");
        assertThat(ref).contains(job);
    }
}
