package dev.reportlenz.render.assist;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Map;

import org.junit.jupiter.api.Test;

import dev.reportlenz.render.api.AssistControlador;
import dev.reportlenz.render.api.AssistControlador.GerarTemplateRequest;
import dev.reportlenz.render.api.AssistControlador.GerarTemplateResponse;
import dev.reportlenz.render.pipeline.ErroDeRender.PullProibido;
import io.micrometer.observation.ObservationRegistry;

/**
 * Assistente A (phase-4/2.2-2.3, ADR-014): prompt anti-Pull, parse tolerante a
 * cercas de markdown, gate anti-Pull na SAÍDA e degradação sem chave (503).
 */
class AssistenteTest {

    /** Cliente falso: devolve a resposta programada sem tocar rede. */
    private static ClienteDeInferencia clienteQueResponde(String resposta) {
        var config = new ConfiguracaoDoAssistente(null, "chave-teste", null, null, null);
        return new ClienteDeInferencia(config) {
            @Override
            public String completar(String sistema, String usuario) {
                return resposta;
            }
        };
    }

    private static AssistControlador controlador(String respostaDoModelo) {
        return new AssistControlador(clienteQueResponde(respostaDoModelo), ObservationRegistry.NOOP);
    }

    @Test
    void promptDeSistemaProibePullEEnsinaOModeloDeDominio() {
        assertThat(PromptDoAssistente.SISTEMA).contains("PROIBIDO");
        assertThat(PromptDoAssistente.SISTEMA).contains("queryString");
        assertThat(PromptDoAssistente.SISTEMA).contains("dataContract");
        assertThat(PromptDoAssistente.SISTEMA).contains("¤ #,##0.00");
        assertThat(PromptDoAssistente.SISTEMA).contains("dd/MM/yyyy");
        // O contrato entra como vocabulário; o template atual habilita refino.
        String usuario = PromptDoAssistente.usuario("uma fatura", "{\"fields\":[]}", "{\"name\":\"x\"}");
        assertThat(usuario).contains("uma fatura").contains("{\"fields\":[]}").contains("REFINE");
    }

    @Test
    void extraiTemplateDeRespostaComCercaDeMarkdown() {
        String resposta = """
                ```json
                {"template": {"name": "fatura_ia", "bands": {"detail": [], "groups": []}},
                 "observacoes": "esqueleto inicial"}
                ```""";
        GerarTemplateResponse r = controlador(resposta)
                .gerarTemplate(new GerarTemplateRequest("fatura simples", Map.of(), null));
        assertThat(r.template().get("name")).isEqualTo("fatura_ia");
        assertThat(r.observacoes()).isEqualTo("esqueleto inicial");
        assertThat(r.modelo()).isEqualTo("google/gemini-2.5-flash"); // default ADR-014 (spike 1.1)
    }

    @Test
    void recusaSaidaComPullMesmoQueOPromptTenhaSidoIgnorado() {
        String comPull = """
                {"template": {"name": "x", "queryString": "SELECT * FROM clientes",
                 "bands": {"detail": [], "groups": []}}, "observacoes": ""}""";
        assertThatThrownBy(() -> controlador(comPull)
                .gerarTemplate(new GerarTemplateRequest("fatura", null, null)))
                .isInstanceOf(PullProibido.class)
                .hasMessageContaining("CONTRACT_PULL_FORBIDDEN");
    }

    @Test
    void respostaForaDoFormatoVira502EDescricaoVaziaNaoChamaOModelo() {
        assertThatThrownBy(() -> controlador("não sei gerar isso")
                .gerarTemplate(new GerarTemplateRequest("fatura", null, null)))
                .isInstanceOf(ErroDoAssistente.RespostaInvalida.class);
        assertThatThrownBy(() -> controlador("{}")
                .gerarTemplate(new GerarTemplateRequest("  ", null, null)))
                .isInstanceOf(ErroDoAssistente.RespostaInvalida.class);
    }

    @Test
    void assistenteB_traduzNlParaExpressaoComVocabularioDoEscopo() {
        String resposta = """
                {"expressao": "$F{quantidade}.multiply($F{precoUnitario})",
                 "explicacao": "total do item = quantidade × preço"}""";
        var r = controlador(resposta).gerarExpressao(new AssistControlador.GerarExpressaoRequest(
                "total do item = quantidade vezes preço unitário",
                Map.of("fields", java.util.List.of("quantidade", "precoUnitario"))));
        assertThat(r.expressao()).isEqualTo("$F{quantidade}.multiply($F{precoUnitario})");
        assertThat(r.explicacao()).contains("quantidade");
        // O prompt de sistema ensina BigDecimal e proíbe SQL.
        assertThat(PromptDoAssistente.SISTEMA_EXPRESSAO).contains(".multiply(").contains("PROIBIDO SQL");
        assertThat(PromptDoAssistente.usuarioExpressao("soma", "{\"fields\":[\"valor\"]}"))
                .contains("soma").contains("valor");
    }

    @Test
    void assistenteB_respostaSemExpressaoVira502() {
        assertThatThrownBy(() -> controlador("{\"explicacao\": \"não entendi\"}")
                .gerarExpressao(new AssistControlador.GerarExpressaoRequest("x", null)))
                .isInstanceOf(ErroDoAssistente.RespostaInvalida.class);
    }

    @Test
    void semChaveConfiguradaDegradaComIaIndisponivel() {
        var semChave = new ClienteDeInferencia(new ConfiguracaoDoAssistente(null, null, null, null, null));
        assertThatThrownBy(() -> semChave.completar("s", "u"))
                .isInstanceOf(ErroDoAssistente.IaIndisponivel.class)
                .hasMessageContaining("OPENROUTER_API_KEY");
        // Defaults da configuração (ADR-014).
        assertThat(semChave.config().baseUrl()).contains("openrouter.ai");
        assertThat(semChave.config().configurado()).isFalse();
    }
}
