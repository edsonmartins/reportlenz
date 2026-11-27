package dev.reportlenz.render;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import io.micrometer.core.instrument.MeterRegistry;

/**
 * Tarefa phase-1/6.1 (RFC-003 §7): atribuição de tempo SEPARADA por etapa —
 * render.compilacao (só compile real; cache hit não conta), render.fill,
 * render.export — exposta em /actuator/prometheus (scrape do VictoriaMetrics).
 * Traces seguem via bridge OTel→OTLP (endpoint por env; Tempo na infra).
 */
@SpringBootTest
@AutoConfigureMockMvc
class ObservabilidadeTest {

    private static final String JRXML = """
            <?xml version="1.0" encoding="UTF-8"?>
            <jasperReport name="observabilidade" pageWidth="595" pageHeight="842" columnWidth="555" \
            leftMargin="20" rightMargin="20" topMargin="30" bottomMargin="30">
            \t<field name="nome" class="java.lang.String"/>
            \t<title height="30">
            \t\t<element kind="textField" x="0" y="0" width="555" height="20">
            \t\t\t<expression><![CDATA[$F{nome}]]></expression>
            \t\t</element>
            \t</title>
            </jasperReport>
            """;

    @Autowired
    private MockMvc mvc;

    @Autowired
    private MeterRegistry metricas;

    private static String jsonString(String s) {
        return '"' + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\t", "\\t") + '"';
    }

    @Test
    void metricasSeparadasPorEtapaEEndpointPrometheus() throws Exception {
        double compilacoesAntes = contagem("render.compilacao");
        double fillsAntes = contagem("render.fill");
        double exportsAntes = contagem("render.export");

        String corpo = "{\"jrxml\":" + jsonString(JRXML) + ",\"sampleData\":{\"nome\":\"Ana\"},\"format\":\"pdf\"}";
        mvc.perform(post("/render/preview").contentType(MediaType.APPLICATION_JSON).content(corpo))
                .andExpect(status().isOk());
        mvc.perform(post("/render/preview").contentType(MediaType.APPLICATION_JSON).content(corpo))
                .andExpect(status().isOk());

        // Atribuição separada: 1 compile (cache hit no 2º), 2 fills, 2 exports.
        assertThat(contagem("render.compilacao") - compilacoesAntes).isEqualTo(1.0);
        assertThat(contagem("render.fill") - fillsAntes).isEqualTo(2.0);
        assertThat(contagem("render.export") - exportsAntes).isEqualTo(2.0);

        // Endpoint de scrape do VictoriaMetrics com as métricas do pipeline.
        String prometheus = mvc.perform(get("/actuator/prometheus"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        assertThat(prometheus).contains("render_compilacao_seconds");
        assertThat(prometheus).contains("render_fill_seconds");
        assertThat(prometheus).contains("render_export_seconds");
        assertThat(prometheus).contains("formato=\"pdf\"");
    }

    private double contagem(String nome) {
        return metricas.find(nome).timers().stream().mapToDouble(t -> t.count()).sum();
    }
}
