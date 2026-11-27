package dev.reportlenz.render.pipeline;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import tools.jackson.databind.json.JsonMapper;

/**
 * Subreport por codename publicado (ADR-020, change subreport-por-codename/3.3):
 * resolução pela versão publicada e por versão fixa, gate G8 (filho não
 * publicado, ciclo), preview com referência quebrada e subreport escolhido
 * pelo payload recusado.
 */
@SpringBootTest
@AutoConfigureMockMvc
class SubreportPorCodenameTest {

    @Autowired
    private MockMvc mvc;

    private final JsonMapper json = JsonMapper.builder().build();

    private static final Map<String, Object> SCHEMA = Map.of(
            "$schema", "https://json-schema.org/draft/2020-12/schema", "type", "object");

    private static String unico(String prefixo) {
        return prefixo + "_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    }

    /** Filho: título com o parâmetro + uma linha por entrega. */
    private static String filho(String marca) {
        return """
                <?xml version="1.0" encoding="UTF-8"?>
                <jasperReport name="filho" pageWidth="555" pageHeight="842" columnWidth="555" \
                leftMargin="0" rightMargin="0" topMargin="0" bottomMargin="0">
                \t<parameter name="cliente" class="java.lang.String"/>
                \t<field name="endereco" class="java.lang.String"/>
                \t<title height="14">
                \t\t<element kind="textField" x="0" y="0" width="555" height="12">
                \t\t\t<expression><![CDATA["%s entregas de " + $P{cliente}]]></expression>
                \t\t</element>
                \t</title>
                \t<detail>
                \t\t<band height="12">
                \t\t\t<element kind="textField" x="0" y="0" width="555" height="12">
                \t\t\t\t<expression><![CDATA["Entrega em " + $F{endereco}]]></expression>
                \t\t\t</element>
                \t\t</band>
                \t</detail>
                </jasperReport>
                """.formatted(marca);
    }

    /** Mestre: subreport DENTRO de um frame (visitor desce em profundidade). */
    private static String mestre(String expressaoDoSubreport) {
        return """
                <?xml version="1.0" encoding="UTF-8"?>
                <jasperReport name="mestre" pageWidth="595" pageHeight="842" columnWidth="555" \
                leftMargin="20" rightMargin="20" topMargin="30" bottomMargin="30">
                \t<field name="cliente_nome" class="java.lang.String"/>
                \t<field name="entregas" class="java.util.List"/>
                \t<title height="80">
                \t\t<element kind="frame" x="0" y="0" width="555" height="80">
                \t\t\t<element kind="subreport" x="0" y="0" width="555" height="60">
                \t\t\t\t<dataSourceExpression><![CDATA[new net.sf.jasperreports.engine.data.JRBeanCollectionDataSource($F{entregas})]]></dataSourceExpression>
                \t\t\t\t<expression><![CDATA[%s]]></expression>
                \t\t\t\t<parameter name="cliente">
                \t\t\t\t\t<expression><![CDATA[$F{cliente_nome}]]></expression>
                \t\t\t\t</parameter>
                \t\t\t</element>
                \t\t</element>
                \t</title>
                </jasperReport>
                """.formatted(expressaoDoSubreport);
    }

    private int salvar(String codename, String jrxml) throws Exception {
        String corpo = mvc.perform(post("/templates/{c}/versoes", codename).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of("jrxml", jrxml, "inputSchema", SCHEMA))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return json.readTree(corpo).get("version").asInt();
    }

    private void publicar(String codename, String jrxml) throws Exception {
        int v = salvar(codename, jrxml);
        mvc.perform(post("/templates/{c}/versoes/{v}/publicar", codename, v)).andExpect(status().isOk());
    }

    private String textoDoPreview(String jrxml) throws Exception {
        String corpo = json.writeValueAsString(Map.of("jrxml", jrxml, "format", "pdf", "sampleData", Map.of(
                "cliente_nome", "Ana",
                "entregas", List.of(Map.of("endereco", "Rua A, 1"), Map.of("endereco", "Rua B, 2")))));
        byte[] pdf = mvc.perform(post("/render/preview").contentType(MediaType.APPLICATION_JSON).content(corpo))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        try (PDDocument doc = Loader.loadPDF(pdf)) {
            return new PDFTextStripper().getText(doc);
        }
    }

    @Test
    void cenarioDoSpec_subreportPublicadoRenderizaComDatasourceEParametro() throws Exception {
        String filho = unico("entregas");
        publicar(filho, filho("V1"));
        String texto = textoDoPreview(mestre("\"repo:" + filho + "\""));
        assertThat(texto).contains("V1 entregas de Ana", "Entrega em Rua A, 1", "Entrega em Rua B, 2");
    }

    @Test
    void cenarioDoSpec_versaoFixaXVersaoAtual() throws Exception {
        String filho = unico("entregas");
        publicar(filho, filho("V1"));
        publicar(filho, filho("V2")); // v1 vira deprecated, v2 published
        assertThat(textoDoPreview(mestre("\"repo:" + filho + "@1\""))).contains("V1 entregas").doesNotContain("V2");
        assertThat(textoDoPreview(mestre("\"repo:" + filho + "\""))).contains("V2 entregas").doesNotContain("V1");
    }

    @Test
    void cenarioDoSpec_publishComFilhoNaoPublicadoBloqueiaNoG8() throws Exception {
        String pai = unico("pai");
        String ausente = unico("ausente");
        int v = salvar(pai, mestre("\"repo:" + ausente + "\""));
        mvc.perform(post("/templates/{c}/versoes/{v}/publicar", pai, v))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.gates[?(@.gate == 'G8')].verde").value(false))
                .andExpect(jsonPath("$.gates[?(@.gate == 'G8')].erros[0]")
                        .value(org.hamcrest.Matchers.hasItem(org.hamcrest.Matchers.containsString("SUBREPORT_INDISPONIVEL"))));
    }

    @Test
    void cenarioDoSpec_cicloEntrePublicadosBloqueiaNoG8() throws Exception {
        String a = unico("a");
        String b = unico("b");
        publicar(b, filho("B"));                         // B v1 sem subreport
        publicar(a, mestre("\"repo:" + b + "\""));       // A → B
        int v2 = salvar(b, mestre("\"repo:" + a + "\"")); // B v2 → A  ⇒ B → A → B
        String resposta = mvc.perform(post("/templates/{c}/versoes/{v}/publicar", b, v2))
                .andExpect(status().isUnprocessableEntity())
                .andReturn().getResponse().getContentAsString();
        assertThat(resposta).contains("SUBREPORT_CICLO").contains(b + " → " + a + " → " + b);
        // /publish/verificar com o codename enxerga o mesmo ciclo.
        mvc.perform(post("/publish/verificar").contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "jrxml", mestre("\"repo:" + a + "\""), "inputSchema", SCHEMA, "codename", b))))
                .andExpect(jsonPath("$.verde").value(false));
    }

    @Test
    void cenarioDoSpec_previewComReferenciaQuebradaRetorna400SemFill() throws Exception {
        String corpo = json.writeValueAsString(Map.of("jrxml", mestre("\"repo:" + unico("nao_existe") + "\""),
                "sampleData", Map.of("cliente_nome", "x")));
        mvc.perform(post("/render/preview").contentType(MediaType.APPLICATION_JSON).content(corpo))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("SUBREPORT_INDISPONIVEL"));
    }

    @Test
    void cenarioDoSpec_subreportEscolhidoPeloPayloadERecusado() throws Exception {
        String jrxml = mestre("$P{sub}").replace("<field name=\"cliente_nome\"",
                "<parameter name=\"sub\" class=\"java.lang.String\"/>\n\t<field name=\"cliente_nome\"");
        String corpo = json.writeValueAsString(Map.of("jrxml", jrxml, "sampleData", Map.of("sub", "repo:x")));
        mvc.perform(post("/render/preview").contentType(MediaType.APPLICATION_JSON).content(corpo))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("EXPRESSAO_PROIBIDA"));
    }
}
