package dev.reportlenz.render.limites;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;

import dev.reportlenz.render.pipeline.CompiladorJrxml;

/**
 * Limites (ADR-018 §2, change endurecimento-operacional/2.3): 413 por tamanho
 * de corpo — com e sem Content-Length — e 400 por itens por lote.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {"reportlenz.limites.max-request-mb=1", "reportlenz.limites.batch-max-itens=3"})
class LimitesTest {

    @Autowired
    private MockMvc mvc;

    @MockitoSpyBean
    private CompiladorJrxml compilador;

    private static String corpoDe(int bytes) {
        return "{\"jrxml\":\"" + "a".repeat(bytes) + "\"}";
    }

    @Test
    void cenarioDoSpec_corpoGrandeDemaisComContentLengthRetorna413() throws Exception {
        mvc.perform(post("/render/preview").contentType(MediaType.APPLICATION_JSON).content(corpoDe(1024 * 1024 + 10)))
                .andExpect(status().isPayloadTooLarge())
                .andExpect(jsonPath("$.codigo").value("REQUISICAO_GRANDE_DEMAIS"));
        verify(compilador, never()).compilar(anyString());
    }

    /** Request "chunked": sem Content-Length declarado. */
    private static MockHttpServletRequest semContentLength(byte[] corpo) {
        MockHttpServletRequest req = new MockHttpServletRequest("POST", "/render/preview") {
            @Override
            public int getContentLength() {
                return -1;
            }

            @Override
            public long getContentLengthLong() {
                return -1;
            }
        };
        req.setContent(corpo);
        return req;
    }

    @Test
    void cenarioDoSpec_corpoGrandeDemaisSemContentLengthRetorna413() throws Exception {
        var filtro = new LimiteDeRequisicao(1);
        var resposta = new MockHttpServletResponse();
        var cadeia = new MockFilterChain();
        filtro.doFilter(semContentLength(corpoDe(1024 * 1024 + 10).getBytes(StandardCharsets.UTF_8)), resposta, cadeia);
        assertThat(resposta.getStatus()).isEqualTo(413);
        assertThat(cadeia.getRequest()).isNull(); // não seguiu adiante
    }

    @Test
    void corpoSemContentLengthDentroDoLimiteChegaIntegro() throws Exception {
        var filtro = new LimiteDeRequisicao(1);
        var cadeia = new MockFilterChain();
        byte[] corpo = corpoDe(1000).getBytes(StandardCharsets.UTF_8);
        filtro.doFilter(semContentLength(corpo), new MockHttpServletResponse(), cadeia);
        assertThat(cadeia.getRequest()).isNotNull();
        assertThat(cadeia.getRequest().getInputStream().readAllBytes()).isEqualTo(corpo);
        assertThat(cadeia.getRequest().getContentLengthLong()).isEqualTo(corpo.length);
    }

    @Test
    void cenarioDoSpec_loteAcimaDoLimiteRetorna400SemCriarJob() throws Exception {
        mvc.perform(post("/render/batch").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"templateCodename\":\"qualquer\",\"payloads\":[{},{},{},{}],\"idempotencyKey\":\"lim-1\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("LOTE_GRANDE_DEMAIS"));
    }
}
