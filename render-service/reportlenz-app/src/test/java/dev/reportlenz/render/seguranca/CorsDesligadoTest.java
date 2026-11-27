package dev.reportlenz.render.seguranca;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

/** Sem origens configuradas (default): nenhuma resposta leva CORS. */
@SpringBootTest
@AutoConfigureMockMvc
class CorsDesligadoTest {

    @Autowired
    MockMvc mvc;

    @Test
    void semOrigensNaoHaCors() throws Exception {
        mvc.perform(options("/render/preview")
                        .header("Origin", "https://app.empresa.com.br")
                        .header("Access-Control-Request-Method", "POST"))
                // Sem cabeçalho CORS, o navegador bloqueia a leitura da resposta pela outra origem.
                .andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
    }
}
