package dev.reportlenz.render.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;

import dev.reportlenz.render.pipeline.CompiladorJrxml;

/**
 * Testes do bloco 2 (RFC-003 §4): POST /render/preview (2.1), compile cache
 * (2.2 — cenário 'Segundo preview do mesmo template') e 400 anti-Pull (2.3 —
 * cenário 'Preview com JRXML Pull').
 */
@SpringBootTest
@AutoConfigureMockMvc
class PreviewControllerTest {

    private static final String JRXML_PUSH = """
            <?xml version="1.0" encoding="UTF-8"?>
            <jasperReport name="preview_push" pageWidth="595" pageHeight="842" columnWidth="555" \
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

    @MockitoSpyBean
    private CompiladorJrxml compilador;

    private static String jsonString(String s) {
        return '"' + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\t", "\\t") + '"';
    }

    private static String corpo(String jrxml, String nome, String format) {
        return "{\"jrxml\":" + jsonString(jrxml)
                + ",\"sampleData\":{\"nome\":" + jsonString(nome) + "}"
                + ",\"format\":" + jsonString(format) + "}";
    }

    @Test
    void previewPdfRetorna200ComPdf() throws Exception {
        byte[] pdf = mvc.perform(post("/render/preview")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(JRXML_PUSH, "Edson", "pdf")))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "application/pdf"))
                .andReturn().getResponse().getContentAsByteArray();
        assertThat(new String(pdf, 0, 4)).isEqualTo("%PDF");
    }

    @Test
    void previewPngRetorna200ComPngETotalDePaginas() throws Exception {
        byte[] png = mvc.perform(post("/render/preview")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(JRXML_PUSH, "Edson", "png")))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "image/png"))
                .andExpect(header().string("X-Total-Pages", "1"))
                .andReturn().getResponse().getContentAsByteArray();
        // Assinatura PNG: 0x89 'P' 'N' 'G'
        assertThat(png[0] & 0xFF).isEqualTo(0x89);
        assertThat(new String(png, 1, 3)).isEqualTo("PNG");
    }

    @Test
    void cenarioDoSpec_segundoPreviewDoMesmoTemplateNaoRecompila() throws Exception {
        mvc.perform(post("/render/preview").contentType(MediaType.APPLICATION_JSON)
                .content(corpo(JRXML_PUSH, "Primeira", "pdf"))).andExpect(status().isOk());
        mvc.perform(post("/render/preview").contentType(MediaType.APPLICATION_JSON)
                .content(corpo(JRXML_PUSH, "Segunda", "pdf"))).andExpect(status().isOk());

        // Compilação uma vez (cache hit no segundo); o fill ocorreu nas duas (200 + 200).
        verify(compilador, times(1)).compilar(anyString());
    }

    @Test
    void cenarioDoSpec_jrxmlPullRetorna400SemRender() throws Exception {
        String pull = JRXML_PUSH.replace(
                "<field name=\"nome\" class=\"java.lang.String\"/>",
                "<query language=\"sql\"><![CDATA[SELECT 1]]></query><field name=\"nome\" class=\"java.lang.String\"/>");
        mvc.perform(post("/render/preview")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo(pull, "x", "pdf")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("CONTRACT_PULL_FORBIDDEN"));
    }

    @Test
    void cenarioDoSpec_payloadForaDoContratoRetorna422SemRender() throws Exception {
        String inputSchema = """
                {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object",
                 "required":["nome"],"properties":{"nome":{"type":"string"}}}""";
        String corpo = "{\"jrxml\":" + jsonString(JRXML_PUSH)
                + ",\"sampleData\":{\"apelido\":\"sem o nome exigido\"}"
                + ",\"inputSchema\":" + inputSchema
                + ",\"format\":\"pdf\"}";

        mvc.perform(post("/render/preview").contentType(MediaType.APPLICATION_JSON).content(corpo))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.codigo").value("PAYLOAD_FORA_DO_CONTRATO"))
                .andExpect(jsonPath("$.violacoes").isNotEmpty());

        // 'nenhum render é executado': o pipeline nem chegou a compilar.
        verify(compilador, never()).compilar(anyString());
    }

    @Test
    void previewComSchemaEPayloadValidoRenderiza200() throws Exception {
        String inputSchema = """
                {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object",
                 "required":["nome"],"properties":{"nome":{"type":"string"}}}""";
        String corpo = "{\"jrxml\":" + jsonString(JRXML_PUSH)
                + ",\"sampleData\":{\"nome\":\"Edson\"}"
                + ",\"inputSchema\":" + inputSchema
                + ",\"format\":\"pdf\"}";

        mvc.perform(post("/render/preview").contentType(MediaType.APPLICATION_JSON).content(corpo))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "application/pdf"));
    }

    @Test
    void jrxmlInvalidoRetorna400() throws Exception {
        mvc.perform(post("/render/preview")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(corpo("<jasperReport name='x'><banda/></jasperReport>", "x", "pdf")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("JRXML_INVALIDO"));
    }
}
