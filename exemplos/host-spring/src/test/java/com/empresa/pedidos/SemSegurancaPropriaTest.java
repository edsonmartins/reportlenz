package com.empresa.pedidos;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Aplicação SEM cadeia de segurança própria (dependia da padrão do Spring
 * Boot). A cadeia do ReportLenz desligaria a padrão — o starter registra a de
 * reserva e as rotas da aplicação continuam protegidas (ADR-026 §3).
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TokensDeTeste.class)
class SemSegurancaPropriaTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ApplicationContext contexto;

    @Test
    void rotasDaAplicacaoContinuamProtegidas() throws Exception {
        assertThat(contexto.containsBean("reportLenzCadeiaDeReserva")).isTrue();
        mvc.perform(get("/api/pedidos/quantidade")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/publico/ping")).andExpect(status().isUnauthorized()); // padrão do Boot: tudo autenticado
        // O ReportLenz segue com a própria cadeia (Bearer).
        mvc.perform(get("/reportlenz/templates/x").header("Authorization", "Bearer " + TokensDeTeste.DESIGNER))
                .andExpect(status().isNotFound());
    }
}
