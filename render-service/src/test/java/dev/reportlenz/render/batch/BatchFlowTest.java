package dev.reportlenz.render.batch;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;

import dev.reportlenz.render.pipeline.CompiladorJrxml;

/**
 * Fluxo completo do batch (tarefas phase-1/5.1-5.3): 202 + fila Redis +
 * worker + estado SQLite + saídas no storage. Cenários do spec:
 * 'Lote de N comprovantes' (compile único, N documentos) e
 * 'Reenvio com mesma idempotencyKey' (sem duplicados).
 *
 * Requer Redis acessível (local em dev; service container no CI).
 */
@SpringBootTest
@AutoConfigureMockMvc
class BatchFlowTest {

    private static final String JRXML = """
            <?xml version="1.0" encoding="UTF-8"?>
            <jasperReport name="batch_push" pageWidth="595" pageHeight="842" columnWidth="555" \
            leftMargin="20" rightMargin="20" topMargin="30" bottomMargin="30">
            \t<field name="nome" class="java.lang.String"/>
            \t<title height="30">
            \t\t<element kind="textField" x="0" y="0" width="555" height="20">
            \t\t\t<expression><![CDATA["Comprovante de " + $F{nome}]]></expression>
            \t\t</element>
            \t</title>
            </jasperReport>
            """;

    private static final String INPUT_SCHEMA = """
            {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object",
             "required":["nome"],"properties":{"nome":{"type":"string"}}}""";

    @Autowired
    private MockMvc mvc;

    @MockitoSpyBean
    private CompiladorJrxml compilador;

    private static String jsonString(String s) {
        return '"' + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\t", "\\t") + '"';
    }

    private String corpoDoLote(String idempotencyKey, String... nomes) {
        StringBuilder payloads = new StringBuilder("[");
        for (int i = 0; i < nomes.length; i++) {
            if (i > 0) payloads.append(',');
            payloads.append("{\"nome\":").append(jsonString(nomes[i])).append('}');
        }
        payloads.append(']');
        return "{\"jrxml\":" + jsonString(JRXML)
                + ",\"inputSchema\":" + INPUT_SCHEMA
                + ",\"payloads\":" + payloads
                + ",\"idempotencyKey\":" + jsonString(idempotencyKey) + "}";
    }

    private String submeter(String corpo) throws Exception {
        String resposta = mvc.perform(post("/render/batch").contentType(MediaType.APPLICATION_JSON).content(corpo))
                .andExpect(status().isAccepted())
                .andReturn().getResponse().getContentAsString();
        Matcher m = Pattern.compile("\"jobId\"\\s*:\\s*\"([^\"]+)\"").matcher(resposta);
        assertThat(m.find()).isTrue();
        return m.group(1);
    }

    private void aguardarConclusao(String jobId) {
        await().atMost(Duration.ofSeconds(30)).pollInterval(Duration.ofMillis(200)).untilAsserted(() ->
                mvc.perform(get("/render/batch/" + jobId)).andExpect(jsonPath("$.status").value("done")));
    }

    @Test
    void cenarioDoSpec_loteDeNComprovantes_compileUnicoEFillN() throws Exception {
        String jobId = submeter(corpoDoLote("lote-" + UUID.randomUUID(), "Ana", "Bento", "Carla"));
        aguardarConclusao(jobId);

        mvc.perform(get("/render/batch/" + jobId))
                .andExpect(jsonPath("$.total").value(3))
                .andExpect(jsonPath("$.done").value(3))
                .andExpect(jsonPath("$.falhas").value(0))
                .andExpect(jsonPath("$.outputs.length()").value(3));

        // Compile único p/ o lote (cache por sha256), fill N.
        verify(compilador, times(1)).compilar(anyString());

        // As saídas existem no storage (padrão MEDIASTORE local) e são PDFs.
        String resposta = mvc.perform(get("/render/batch/" + jobId)).andReturn().getResponse().getContentAsString();
        Matcher m = Pattern.compile("\"([^\"]+\\.pdf)\"").matcher(resposta);
        assertThat(m.find()).isTrue();
        Path primeira = Path.of(m.group(1));
        assertThat(Files.exists(primeira)).isTrue();
        byte[] pdf = Files.readAllBytes(primeira);
        assertThat(new String(pdf, 0, 4)).isEqualTo("%PDF");
    }

    @Test
    void cenarioDoSpec_reenvioComMesmaIdempotencyKeyNaoDuplicaDocumentos() throws Exception {
        String chave = "lote-idem-" + UUID.randomUUID();
        String corpo = corpoDoLote(chave, "Diego", "Elisa");

        String jobId1 = submeter(corpo);
        aguardarConclusao(jobId1);

        String jobId2 = submeter(corpo);
        assertThat(jobId2).isEqualTo(jobId1);

        // Sem documentos duplicados: continuam exatamente 2 saídas.
        mvc.perform(get("/render/batch/" + jobId1))
                .andExpect(jsonPath("$.total").value(2))
                .andExpect(jsonPath("$.done").value(2))
                .andExpect(jsonPath("$.outputs.length()").value(2));
    }

    @Test
    void itemForaDoContratoViraFalhaRegistradaSemDerrubarOLote() throws Exception {
        String corpo = "{\"jrxml\":" + jsonString(JRXML)
                + ",\"inputSchema\":" + INPUT_SCHEMA
                + ",\"payloads\":[{\"nome\":\"Fabio\"},{\"apelido\":\"sem nome\"}]"
                + ",\"idempotencyKey\":" + jsonString("lote-falha-" + UUID.randomUUID()) + "}";
        String jobId = submeter(corpo);
        aguardarConclusao(jobId);

        mvc.perform(get("/render/batch/" + jobId))
                .andExpect(jsonPath("$.total").value(2))
                .andExpect(jsonPath("$.done").value(1))
                .andExpect(jsonPath("$.falhas").value(1))
                .andExpect(jsonPath("$.erros[0].idx").value(1));
    }

    @Test
    void requisicaoSemIdempotencyKeyRetorna400() throws Exception {
        String corpo = "{\"jrxml\":" + jsonString(JRXML) + ",\"payloads\":[{\"nome\":\"x\"}]}";
        mvc.perform(post("/render/batch").contentType(MediaType.APPLICATION_JSON).content(corpo))
                .andExpect(status().isBadRequest());
    }

    @Test
    void jobDesconhecidoRetorna404() throws Exception {
        mvc.perform(get("/render/batch/nao-existe")).andExpect(status().isNotFound());
    }
}
