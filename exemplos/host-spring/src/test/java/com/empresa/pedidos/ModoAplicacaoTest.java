package com.empresa.pedidos;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.httpBasic;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.ApplicationContext;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/**
 * reportlenz.seguranca.modo=aplicacao (ADR-026 §3): o ReportLenz NÃO registra
 * cadeia; a aplicação protege também /reportlenz/** (aqui, HTTP Basic) e o
 * ator da auditoria é o principal dela.
 */
@SpringBootTest(properties = "reportlenz.seguranca.modo=aplicacao")
@AutoConfigureMockMvc
@ActiveProfiles("com-seguranca-propria")
class ModoAplicacaoTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcClient jdbc;

    @Autowired
    ApplicationContext contexto;

    @Test
    void aplicacaoProtegeEAuditaComOProprioUsuario() throws Exception {
        assertThat(contexto.containsBean("reportLenzSecurityFilterChain")).isFalse();
        String corpo = "{\"jrxml\":\"<?xml version=\\\"1.0\\\" encoding=\\\"UTF-8\\\"?><jasperReport name=\\\"m\\\" pageWidth=\\\"595\\\" pageHeight=\\\"842\\\" columnWidth=\\\"555\\\"><field name=\\\"nome\\\" class=\\\"java.lang.String\\\"/><title height=\\\"20\\\"><element kind=\\\"textField\\\" x=\\\"0\\\" y=\\\"0\\\" width=\\\"200\\\" height=\\\"20\\\"><expression><![CDATA[$F{nome}]]></expression></element></title></jasperReport>\"}";
        mvc.perform(post("/reportlenz/templates/modo_aplicacao/versoes").contentType("application/json").content(corpo))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/reportlenz/templates/modo_aplicacao/versoes").with(httpBasic("operador", "senha-de-teste"))
                        .contentType("application/json").content(corpo))
                .andExpect(status().isOk());
        assertThat(jdbc.sql("""
                SELECT a.actor FROM report_template_audit a
                JOIN report_template_version v ON v.id = a.version_id
                JOIN report_template t ON t.id = v.template_id
                WHERE t.codename = 'modo_aplicacao'""").query(String.class).list()).containsOnly("operador");
    }
}
