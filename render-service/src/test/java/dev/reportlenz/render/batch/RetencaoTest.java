package dev.reportlenz.render.batch;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Retenção LGPD (ADR-018 §1, change endurecimento-operacional/2.2): payload
 * zerado ao terminar (done e failed/poison) e purga de jobs terminados além do
 * prazo — banco + PDFs —, preservando jobs em andamento.
 */
@SpringBootTest
@AutoConfigureMockMvc
class RetencaoTest {

    private static final String JRXML = """
            <?xml version="1.0" encoding="UTF-8"?>
            <jasperReport name="ret" pageWidth="595" pageHeight="842" columnWidth="555" \
            leftMargin="20" rightMargin="20" topMargin="30" bottomMargin="30">
            \t<field name="nome" class="java.lang.String"/>
            \t<title height="30">
            \t\t<element kind="textField" x="0" y="0" width="555" height="20">
            \t\t\t<expression><![CDATA["Olá, " + $F{nome}]]></expression>
            \t\t</element>
            \t</title>
            </jasperReport>
            """;

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JdbcClient jdbc;

    @Autowired
    private RepositorioDeJobs repositorio;

    @Autowired
    private PurgaDeRetencao purga;

    private static String jsonString(String s) {
        return '"' + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\t", "\\t") + '"';
    }

    private String loteConcluido() throws Exception {
        String codename = "ret_" + UUID.randomUUID().toString().replace("-", "");
        mvc.perform(post("/templates/{c}/versoes", codename).contentType(MediaType.APPLICATION_JSON)
                .content("{\"jrxml\":" + jsonString(JRXML) + ",\"inputSchema\":{\"type\":\"object\"}}"))
                .andExpect(status().isOk());
        mvc.perform(post("/templates/{c}/versoes/1/publicar", codename)).andExpect(status().isOk());
        String resposta = mvc.perform(post("/render/batch").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"templateCodename\":\"" + codename + "\",\"payloads\":[{\"nome\":\"CPF 123.456.789-00\"}]"
                                + ",\"idempotencyKey\":\"ret-" + UUID.randomUUID() + "\"}"))
                .andExpect(status().isAccepted()).andReturn().getResponse().getContentAsString();
        Matcher m = Pattern.compile("\"jobId\"\\s*:\\s*\"([^\"]+)\"").matcher(resposta);
        assertThat(m.find()).isTrue();
        String jobId = m.group(1);
        await().atMost(Duration.ofSeconds(30)).pollInterval(Duration.ofMillis(200)).untilAsserted(() ->
                mvc.perform(get("/render/batch/" + jobId)).andExpect(jsonPath("$.status").value("done")));
        return jobId;
    }

    private String payloads(String jobId) {
        return jdbc.sql("SELECT payloads FROM render_job WHERE id = :id").param("id", jobId).query(String.class).single();
    }

    private void envelhecer(String jobId, int dias) {
        jdbc.sql("UPDATE render_job SET atualizado_em = :t WHERE id = :id")
                .param("t", Instant.now().minus(Duration.ofDays(dias)).toString()).param("id", jobId).update();
    }

    @Test
    void cenarioDoSpec_loteConcluidoZeraPayloadsEMantemStatus() throws Exception {
        String jobId = loteConcluido();
        assertThat(payloads(jobId)).isEqualTo("[]");
        mvc.perform(get("/render/batch/" + jobId))
                .andExpect(jsonPath("$.done").value(1))
                .andExpect(jsonPath("$.outputs.length()").value(1));
    }

    @Test
    void cenarioDoSpec_mensagemVenenosaTambemZeraPayloads() {
        var criado = repositorio.criarSeNovo("ret-poison-" + UUID.randomUUID(), JRXML, null, "[{\"nome\":\"x\"}]", 1);
        repositorio.atualizarStatus(criado.jobId(), "running");
        assertThat(payloads(criado.jobId())).isEqualTo("[{\"nome\":\"x\"}]");
        repositorio.atualizarStatus(criado.jobId(), "failed"); // caminho do poison cap
        assertThat(payloads(criado.jobId())).isEqualTo("[]");
    }

    @Test
    void cenarioDoSpec_jobExpiradoSomeDoBancoEDoStorage() throws Exception {
        String jobId = loteConcluido();
        String status = mvc.perform(get("/render/batch/" + jobId)).andReturn().getResponse().getContentAsString();
        Matcher m = Pattern.compile("\"([^\"]+\\.pdf)\"").matcher(status);
        assertThat(m.find()).isTrue();
        Path pdf = Path.of(m.group(1));
        assertThat(Files.exists(pdf)).isTrue();

        envelhecer(jobId, 31);
        assertThat(purga.executar(Instant.now())).isGreaterThanOrEqualTo(1);

        mvc.perform(get("/render/batch/" + jobId)).andExpect(status().isNotFound());
        assertThat(Files.exists(pdf)).isFalse();
        assertThat(Files.exists(pdf.getParent())).isFalse();
        assertThat(jdbc.sql("SELECT COUNT(*) FROM render_job_saida WHERE job_id = :id").param("id", jobId)
                .query(Integer.class).single()).isZero();
    }

    @Test
    void jobDentroDoPrazoNaoEPurgado() throws Exception {
        String jobId = loteConcluido();
        envelhecer(jobId, 29);
        purga.executar(Instant.now());
        mvc.perform(get("/render/batch/" + jobId)).andExpect(status().isOk());
    }

    @Test
    void cenarioDoSpec_jobEmAndamentoAntigoNaoEPurgado() {
        var criado = repositorio.criarSeNovo("ret-running-" + UUID.randomUUID(), JRXML, null, "[{}]", 1);
        repositorio.atualizarStatus(criado.jobId(), "running");
        envelhecer(criado.jobId(), 90);
        purga.executar(Instant.now());
        assertThat(repositorio.consultar(criado.jobId())).isPresent();
    }
}
