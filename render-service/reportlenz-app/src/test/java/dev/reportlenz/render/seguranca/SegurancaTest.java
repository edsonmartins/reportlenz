package dev.reportlenz.render.seguranca;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import dev.reportlenz.render.pipeline.CompiladorJrxml;

/**
 * Cenários do spec `autenticacao` (ADR-017, change autenticacao-keycloak/2.5):
 * 401 sem token, papéis por endpoint (realm e client roles), ator derivado do
 * token (corpo ignorado), rendered_batch com o service account, actuator fora
 * da porta da aplicação e fail-closed sem issuer.
 *
 * O JwtDecoder é substituído: cada "token" opaco do teste mapeia para um Jwt
 * com as claims que o Keycloak emitiria — o conversor de papéis e o nome do
 * ator rodam de verdade.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "reportlenz.seguranca.habilitada=true",
        "reportlenz.seguranca.issuer=http://127.0.0.1:1/realms/teste",
        "reportlenz.seguranca.client-id=reportlenz"})
@org.springframework.context.annotation.Import(dev.reportlenz.render.seguranca.DecodificadorDeTeste.class)
class SegurancaTest {

    private static final String JRXML = """
            <?xml version="1.0" encoding="UTF-8"?>
            <jasperReport name="seg" pageWidth="595" pageHeight="842" columnWidth="555" \
            leftMargin="20" rightMargin="20" topMargin="30" bottomMargin="30">
            \t<field name="nome" class="java.lang.String"/>
            \t<title height="30">
            \t\t<element kind="textField" x="0" y="0" width="555" height="20">
            \t\t\t<expression><![CDATA["Olá, " + $F{nome}]]></expression>
            \t\t</element>
            \t</title>
            </jasperReport>
            """;

    private static final String SCHEMA = """
            {"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object",
             "required":["nome"],"properties":{"nome":{"type":"string"}}}""";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JdbcClient jdbc;

    @MockitoBean
    private JwtDecoder decoder;

    @MockitoSpyBean
    private CompiladorJrxml compilador;

    @BeforeEach
    void tokens() {
        when(decoder.decode(anyString())).thenThrow(new BadJwtException("token inválido"));
        registrar("ana", jwt("ana", List.of(ConfiguracaoDeSeguranca.DESIGNER), Map.of()));
        registrar("bia", jwt("bia", List.of(ConfiguracaoDeSeguranca.DESIGNER, ConfiguracaoDeSeguranca.PUBLICADOR), Map.of()));
        // Service account: papel como CLIENT role (resource_access.reportlenz.roles).
        registrar("erp", jwt("service-account-erp", List.of(),
                Map.of("reportlenz", Map.of("roles", List.of(ConfiguracaoDeSeguranca.BATCH)))));
        // Papel de OUTRO client não vale.
        registrar("intruso", jwt("intruso", List.of(),
                Map.of("outro-client", Map.of("roles", List.of(ConfiguracaoDeSeguranca.BATCH)))));
    }

    private void registrar(String token, Jwt jwt) {
        org.mockito.Mockito.doReturn(jwt).when(decoder).decode(token);
    }

    private static Jwt jwt(String usuario, List<String> realmRoles, Map<String, Object> resourceAccess) {
        Jwt.Builder b = Jwt.withTokenValue("t-" + usuario)
                .header("alg", "RS256")
                .subject(UUID.randomUUID().toString())
                .claim("preferred_username", usuario)
                .claim("realm_access", Map.of("roles", realmRoles))
                .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(300));
        if (!resourceAccess.isEmpty()) {
            b.claim("resource_access", resourceAccess);
        }
        return b.build();
    }

    private static MockHttpServletRequestBuilder comToken(MockHttpServletRequestBuilder req, String token) {
        return req.header("Authorization", "Bearer " + token);
    }

    private static String jsonString(String s) {
        return '"' + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\t", "\\t") + '"';
    }

    private static String corpoPreview() {
        return "{\"jrxml\":" + jsonString(JRXML) + ",\"sampleData\":{\"nome\":\"x\"},\"format\":\"pdf\"}";
    }

    private String publicarComo(String token) throws Exception {
        String codename = "seg_" + UUID.randomUUID().toString().replace("-", "");
        mvc.perform(comToken(post("/templates/{c}/versoes", codename), token).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jrxml\":" + jsonString(JRXML) + ",\"inputSchema\":" + SCHEMA
                                + ",\"actor\":\"diretor\"}"))
                .andExpect(status().isOk());
        mvc.perform(comToken(post("/templates/{c}/versoes/1/publicar", codename), token)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"actor\":\"diretor\"}"))
                .andExpect(status().isOk());
        return codename;
    }

    // ----------------------------------------------------------------- 401

    @Test
    void cenarioDoSpec_previewSemTokenRetorna401ENaoCompila() throws Exception {
        mvc.perform(post("/render/preview").contentType(MediaType.APPLICATION_JSON).content(corpoPreview()))
                .andExpect(status().isUnauthorized());
        verify(compilador, never()).compilar(anyString());
    }

    @Test
    void tokenInvalidoRetorna401() throws Exception {
        mvc.perform(comToken(post("/render/preview"), "forjado").contentType(MediaType.APPLICATION_JSON)
                        .content(corpoPreview()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void designerRenderizaPreview() throws Exception {
        mvc.perform(comToken(post("/render/preview"), "ana").contentType(MediaType.APPLICATION_JSON)
                        .content(corpoPreview()))
                .andExpect(status().isOk());
    }

    // ----------------------------------------------------------------- 403

    @Test
    void cenarioDoSpec_designerTentaPublicarRecebe403() throws Exception {
        String codename = "seg_" + UUID.randomUUID().toString().replace("-", "");
        mvc.perform(comToken(post("/templates/{c}/versoes", codename), "ana").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"jrxml\":" + jsonString(JRXML) + ",\"inputSchema\":" + SCHEMA + "}"))
                .andExpect(status().isOk());
        mvc.perform(comToken(post("/templates/{c}/versoes/1/publicar", codename), "ana"))
                .andExpect(status().isForbidden());
    }

    @Test
    void cenarioDoSpec_designerTentaDispararLoteRecebe403() throws Exception {
        mvc.perform(comToken(post("/render/batch"), "ana").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"templateCodename\":\"x\",\"payloads\":[{}],\"idempotencyKey\":\"k\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void serviceAccountNaoLeTemplatesNemRenderizaPreview() throws Exception {
        mvc.perform(comToken(get("/templates/x"), "erp")).andExpect(status().isForbidden());
        mvc.perform(comToken(post("/render/preview"), "erp").contentType(MediaType.APPLICATION_JSON)
                .content(corpoPreview())).andExpect(status().isForbidden());
    }

    @Test
    void papelDeOutroClientNaoVale() throws Exception {
        mvc.perform(comToken(post("/render/batch"), "intruso").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"templateCodename\":\"x\",\"payloads\":[{}],\"idempotencyKey\":\"k\"}"))
                .andExpect(status().isForbidden());
    }

    // ------------------------------------------------------- ator do token

    @Test
    void cenarioDoSpec_corpoTentaForjarOAtor_registraOUsuarioDoToken() throws Exception {
        String codename = publicarComo("bia");
        mvc.perform(comToken(get("/templates/{c}", codename), "bia"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].criadoPor").value("bia"));
        List<String> atores = jdbc.sql("""
                        SELECT a.actor FROM report_template_audit a
                        JOIN report_template_version v ON v.id = a.version_id
                        JOIN report_template t ON t.id = v.template_id
                        WHERE t.codename = :c ORDER BY a.at""")
                .param("c", codename).query(String.class).list();
        assertThat(atores).isNotEmpty().allMatch("bia"::equals);
    }

    @Test
    void cenarioDoSpec_backendSubmeteLote_auditadoComServiceAccount() throws Exception {
        String codename = publicarComo("bia");
        String chave = "seg-" + UUID.randomUUID();
        mvc.perform(comToken(post("/render/batch"), "erp").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"templateCodename\":\"" + codename + "\",\"payloads\":[{\"nome\":\"x\"}]"
                                + ",\"idempotencyKey\":\"" + chave + "\"}"))
                .andExpect(status().isAccepted());
        String ator = jdbc.sql("""
                        SELECT a.actor FROM report_template_audit a
                        JOIN report_template_version v ON v.id = a.version_id
                        JOIN report_template t ON t.id = v.template_id
                        WHERE t.codename = :c AND a.action = 'rendered_batch'""")
                .param("c", codename).query(String.class).single();
        assertThat(ator).isEqualTo("service-account-erp");
    }

    // ------------------------------------------------------------ actuator

    @Test
    void cenarioDoSpec_actuatorNaPortaDaAplicacaoNaoExpoeMetricas() throws Exception {
        mvc.perform(get("/actuator/prometheus")).andExpect(status().isUnauthorized());
        String corpo = mvc.perform(comToken(get("/actuator/prometheus"), "bia"))
                .andExpect(status().isForbidden())
                .andReturn().getResponse().getContentAsString();
        assertThat(corpo).doesNotContain("jvm_");
    }

    // ---------------------------------------------------------- fail-closed

    @Test
    void cenarioDoSpec_bootSemIssuerComSegurancaHabilitadaFalha() {
        assertThatThrownBy(() -> new ConfiguracaoDeSeguranca(true, "  ", "reportlenz", -1))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("REPORTLENZ_OIDC_ISSUER");
    }

    /** Achado no boot real: Keycloak fora do ar no discovery não pode virar 500. */
    @Test
    void emissorIndisponivelViraTokenInvalidoNao500() {
        var config = new ConfiguracaoDeSeguranca(true, "http://127.0.0.1:1/realms/fora", "reportlenz", -1);
        assertThatThrownBy(() -> config.jwtDecoder().decode("qualquer"))
                .isInstanceOf(BadJwtException.class)
                .hasMessageContaining("emissor de identidade indisponível");
    }
}
