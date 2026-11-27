package com.empresa.pedidos;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/**
 * ADR-026 (change backend-embarcavel/2.4): o starter numa aplicação com
 * segurança, Flyway e rotas PRÓPRIAS. Scenarios "Rotas sob prefixo",
 * "Segurança escopada", "Flyway isolado" e "Renderizar pela API Java".
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("com-seguranca-propria")
@Import(TokensDeTeste.class)
class CoexistenciaTest {

    private static final String JRXML = """
            <?xml version="1.0" encoding="UTF-8"?>
            <jasperReport name="ola" pageWidth="595" pageHeight="842" columnWidth="555" leftMargin="20" rightMargin="20" topMargin="30" bottomMargin="30">
            \t<field name="nome" class="java.lang.String"/>
            \t<title height="30">
            \t\t<element kind="textField" x="0" y="0" width="555" height="20">
            \t\t\t<expression><![CDATA["Olá, " + $F{nome}]]></expression>
            \t\t</element>
            \t</title>
            </jasperReport>""";

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcClient jdbc;

    @Autowired
    ApplicationContext contexto;

    private static String json(String texto) {
        return "\"" + texto.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\t", "\\t") + "\"";
    }

    private static String preview() {
        return "{\"jrxml\":" + json(JRXML) + ",\"sampleData\":{\"nome\":\"Maria\"},\"format\":\"pdf\"}";
    }

    @Test
    void rotasESegurancaDaAplicacaoSeguemIntactas() throws Exception {
        mvc.perform(get("/api/publico/ping")).andExpect(status().isOk());
        mvc.perform(get("/api/pedidos/quantidade")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/pedidos/quantidade").with(httpBasic("operador", "senha-de-teste")))
                .andExpect(status().isOk())
                .andExpect(content().json("{\"pedidos\":2}"));
    }

    @Test
    void reportLenzSobOPrefixoComJwtEPapeis() throws Exception {
        // Sem token: a cadeia DO REPORTLENZ responde (401 Bearer), não a da aplicação.
        mvc.perform(post("/reportlenz/render/preview").contentType("application/json").content(preview()))
                .andExpect(status().isUnauthorized());
        // Credencial da aplicação não vale para o ReportLenz.
        mvc.perform(post("/reportlenz/render/preview").with(httpBasic("operador", "senha-de-teste"))
                        .contentType("application/json").content(preview()))
                .andExpect(status().isUnauthorized());
        // Token com reportlenz-designer: PDF real.
        byte[] pdf = mvc.perform(post("/reportlenz/render/preview").header("Authorization", "Bearer " + TokensDeTeste.DESIGNER)
                        .contentType("application/json").content(preview()))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsByteArray();
        try (var doc = Loader.loadPDF(pdf)) {
            assertThat(new PDFTextStripper().getText(doc)).contains("Olá, Maria");
        }
        // Sem o prefixo não é ReportLenz: a rota não existe para a aplicação.
        mvc.perform(post("/render/preview").with(httpBasic("operador", "senha-de-teste"))
                        .contentType("application/json").content(preview()))
                .andExpect(status().isNotFound());
    }

    @Test
    void registroNoBancoDaAplicacaoComAuditoriaDoToken() throws Exception {
        mvc.perform(post("/reportlenz/templates/ola/versoes").header("Authorization", "Bearer " + TokensDeTeste.DESIGNER)
                        .contentType("application/json").content("{\"jrxml\":" + json(JRXML) + "}"))
                .andExpect(status().isOk());
        assertThat(jdbc.sql("""
                SELECT a.actor FROM report_template_audit a
                JOIN report_template_version v ON v.id = a.version_id
                JOIN report_template t ON t.id = v.template_id
                WHERE t.codename = 'ola'""").query(String.class).list())
                .contains("ana.designer");
    }

    @Test
    void flywayDaAplicacaoEDoReportLenzEmHistoricosSeparados() {
        assertThat(jdbc.sql("SELECT version FROM flyway_schema_history WHERE version IS NOT NULL ORDER BY installed_rank")
                .query(String.class).list()).containsExactly("1", "2");
        assertThat(jdbc.sql("SELECT version FROM reportlenz_schema_history WHERE version IS NOT NULL")
                .query(String.class).list()).contains("1", "2");
    }

    @Test
    void aplicacaoUsaOMotorPelaApiJava() throws Exception {
        byte[] pdf = mvc.perform(get("/api/pedidos/1/comprovante.pdf").with(httpBasic("operador", "senha-de-teste")))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsByteArray();
        try (var doc = Loader.loadPDF(pdf)) {
            assertThat(new PDFTextStripper().getText(doc)).contains("Pedido nº 1 — Padaria São João", "R$ 1.234,50");
        }
    }

    @Test
    void nadaGlobalVazaParaAAplicacao() {
        // Decoder JWT e CORS do ReportLenz não aparecem como beans "padrão" para a aplicação.
        assertThat(contexto.getBeansOfType(JwtDecoder.class)).isEmpty();
        assertThat(contexto.containsBean("corsConfigurationSource")).isFalse();
        // Agendamento da aplicação continua desligado (o starter não liga @EnableScheduling).
        assertThat(contexto.containsBean("org.springframework.context.annotation.internalScheduledAnnotationProcessor")).isFalse();
        // A cadeia de reserva não é registrada: a aplicação tem cadeia própria.
        assertThat(contexto.containsBean("reportLenzCadeiaDeReserva")).isFalse();
        assertThat(List.of(contexto.getBeanNamesForType(org.springframework.security.web.SecurityFilterChain.class)))
                .containsExactlyInAnyOrder("cadeiaDaAplicacao", "reportLenzSecurityFilterChain");
    }
}
