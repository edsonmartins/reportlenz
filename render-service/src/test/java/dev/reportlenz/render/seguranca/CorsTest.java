package dev.reportlenz.render.seguranca;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Scenario "Serviço em outra origem" (ADR-025 §4, change
 * componente-embutivel/3.1): só as origens de REPORTLENZ_CORS_ORIGENS
 * recebem CORS; as demais são recusadas no preflight.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = "reportlenz.cors.origens-permitidas=https://app.empresa.com.br, https://erp.empresa.com.br")
class CorsTest {

    @Autowired
    MockMvc mvc;

    @Test
    void preflightDeOrigemPermitidaRecebeCabecalhos() throws Exception {
        mvc.perform(options("/render/preview")
                        .header("Origin", "https://app.empresa.com.br")
                        .header("Access-Control-Request-Method", "POST")
                        .header("Access-Control-Request-Headers", "authorization,content-type"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "https://app.empresa.com.br"))
                .andExpect(header().exists("Access-Control-Allow-Methods"));
    }

    @Test
    void origemForaDaListaERecusada() throws Exception {
        mvc.perform(options("/render/preview")
                        .header("Origin", "https://intruso.example")
                        .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isForbidden())
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
    }

    @Test
    void respostaRealExpoeOTotalDePaginas() throws Exception {
        mvc.perform(post("/render/preview")
                        .header("Origin", "https://erp.empresa.com.br")
                        .contentType("application/json")
                        .content("{}"))
                // Corpo sem jrxml → 400 JRXML_AUSENTE (era NPE/500) — e a resposta de erro também leva CORS.
                .andExpect(status().isBadRequest())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath("$.codigo").value("JRXML_AUSENTE"))
                .andExpect(header().string("Access-Control-Allow-Origin", "https://erp.empresa.com.br"))
                .andExpect(header().string("Access-Control-Expose-Headers", org.hamcrest.Matchers.containsString("X-Total-Pages")));
    }

    @Test
    void curingaEhRecusadoNoBoot() {
        assertThatThrownBy(() -> new ConfiguracaoDeCors().fonteDeCors(List.of("*")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("não aceita '*'");
    }
}
