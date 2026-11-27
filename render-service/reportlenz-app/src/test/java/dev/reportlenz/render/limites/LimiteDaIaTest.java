package dev.reportlenz.render.limites;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import dev.reportlenz.render.assist.ClienteDeInferencia;
import dev.reportlenz.render.assist.ConfiguracaoDoAssistente;
import dev.reportlenz.render.seguranca.ConfiguracaoDeSeguranca;

/**
 * Rate limit da IA por usuário (ADR-018 §3, change endurecimento-operacional/2.4):
 * N chamadas por minuto, a N+1 → 429 sem tocar o provedor; outro usuário segue;
 * Redis fora do ar → fail-open.
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "reportlenz.seguranca.habilitada=true",
        "reportlenz.seguranca.issuer=http://127.0.0.1:1/realms/teste",
        "reportlenz.assist.limite-por-minuto=2"})
@org.springframework.context.annotation.Import(dev.reportlenz.render.seguranca.DecodificadorDeTeste.class)
class LimiteDaIaTest {

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private JwtDecoder decoder;

    @MockitoBean
    private ClienteDeInferencia cliente;

    @BeforeEach
    void preparar() {
        for (String usuario : List.of("ana", "bia")) {
            Jwt jwt = Jwt.withTokenValue("t-" + usuario).header("alg", "RS256").subject(usuario)
                    .claim("preferred_username", usuario + "-" + Instant.now().toEpochMilli())
                    .claim("realm_access", Map.of("roles", List.of(ConfiguracaoDeSeguranca.DESIGNER)))
                    .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(300)).build();
            doReturn(jwt).when(decoder).decode(usuario);
        }
        when(cliente.config()).thenReturn(new ConfiguracaoDoAssistente(null, "k", "modelo-teste", null, null));
        when(cliente.completar(anyString(), anyString()))
                .thenReturn("{\"expressao\":\"$F{nome}\",\"explicacao\":\"ok\"}");
    }

    private org.springframework.test.web.servlet.ResultActions pedir(String token) throws Exception {
        return mvc.perform(post("/assist/gerar-expressao").header("Authorization", "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"descricao\":\"nome do cliente\",\"escopo\":{\"fields\":[\"nome\"]}}"));
    }

    @Test
    void cenarioDoSpec_usuarioExcedeOLimite_outroNaoEAfetado() throws Exception {
        // Evita cruzar a virada de minuto no meio do teste (janela fixa).
        if (Instant.now().getEpochSecond() % 60 > 55) {
            Thread.sleep(6000);
        }
        pedir("ana").andExpect(status().isOk());
        pedir("ana").andExpect(status().isOk());
        pedir("ana").andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"))
                .andExpect(jsonPath("$.codigo").value("IA_LIMITE_EXCEDIDO"));
        // O provedor só foi chamado nas 2 permitidas.
        verify(cliente, times(2)).completar(anyString(), anyString());

        pedir("bia").andExpect(status().isOk());
    }

    @Test
    @SuppressWarnings("unchecked")
    void redisForaDoArLiberaAChamada() throws Exception {
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        ValueOperations<String, String> ops = mock(ValueOperations.class);
        when(redis.opsForValue()).thenReturn(ops);
        when(ops.increment(anyString())).thenThrow(new RedisConnectionFailureException("fora"));
        var limite = new LimiteDaIa(redis, 1, "x:");
        assertThat(limite.preHandle(new MockHttpServletRequest(), new MockHttpServletResponse(), null)).isTrue();
    }
}
