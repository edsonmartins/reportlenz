package dev.reportlenz.render.api;

import java.util.Map;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import dev.reportlenz.render.assist.ClienteDeInferencia;
import dev.reportlenz.render.assist.ErroDoAssistente.RespostaInvalida;
import dev.reportlenz.render.assist.PromptDoAssistente;
import dev.reportlenz.render.pipeline.ErroDeRender.PullProibido;
import io.micrometer.observation.Observation;
import io.micrometer.observation.ObservationRegistry;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/**
 * Assistente A — NL → ReportTemplate draft (RFC-005 §2, ADR-014; tarefas
 * phase-4/2.2-2.3). Padrão do copiloto do mentors-ipaas-admin: REST sem
 * streaming, prompts/chave só aqui, e a resposta é um DRAFT estruturado que o
 * designer valida (validateSchema+validateContract no jrxml-core) ANTES de
 * exibir no canvas — a IA não fura gates (2.4 acontece no front).
 *
 * - 200: {template, observacoes, modelo}
 * - 400: saída com Pull (gate anti-Pull também aqui, defesa em profundidade)
 * - 502: modelo respondeu fora do formato
 * - 503: IA indisponível (sem chave/provedor fora) — o designer degrada
 */
@RestController
public class AssistControlador {

    private final ClienteDeInferencia cliente;
    private final ObservationRegistry observacoes;
    private final JsonMapper json = JsonMapper.builder().build();

    public AssistControlador(ClienteDeInferencia cliente, ObservationRegistry observacoes) {
        this.cliente = cliente;
        this.observacoes = observacoes;
    }

    public record GerarTemplateRequest(
            String descricao,
            Map<String, Object> contrato,
            Map<String, Object> templateAtual) {}

    public record GerarTemplateResponse(Map<String, Object> template, String observacoes, String modelo) {}

    @PostMapping("/assist/gerar-template")
    public GerarTemplateResponse gerarTemplate(@RequestBody GerarTemplateRequest request) {
        if (request.descricao() == null || request.descricao().isBlank()) {
            throw new RespostaInvalida("descricao vazia — nada a gerar", null);
        }
        String usuario = PromptDoAssistente.usuario(
                request.descricao(),
                request.contrato() == null ? null : json.writeValueAsString(request.contrato()),
                request.templateAtual() == null ? null : json.writeValueAsString(request.templateAtual()));

        String conteudo = Observation.createNotStarted("assist.gerar_template", observacoes)
                .lowCardinalityKeyValue("modelo", cliente.config().model())
                .observe(() -> cliente.completar(PromptDoAssistente.SISTEMA, usuario));

        Map<String, Object> corpo = parsear(conteudo);
        Object template = corpo.get("template");
        if (!(template instanceof Map)) {
            throw new RespostaInvalida("resposta sem \"template\" — o modelo fugiu do formato", null);
        }
        recusarPull(json.writeValueAsString(template));

        @SuppressWarnings("unchecked")
        Map<String, Object> templateMap = (Map<String, Object>) template;
        Object obs = corpo.get("observacoes");
        return new GerarTemplateResponse(templateMap, obs instanceof String s ? s : "", cliente.config().model());
    }

    /** Aceita JSON puro ou cercado em ```json ... ``` (modelos adoram cercas). */
    private Map<String, Object> parsear(String conteudo) {
        String texto = conteudo == null ? "" : conteudo.strip();
        if (texto.startsWith("```")) {
            int inicio = texto.indexOf('\n');
            int fim = texto.lastIndexOf("```");
            if (inicio >= 0 && fim > inicio) {
                texto = texto.substring(inicio + 1, fim).strip();
            }
        }
        try {
            return json.readValue(texto, new TypeReference<Map<String, Object>>() {});
        } catch (RuntimeException e) {
            throw new RespostaInvalida("resposta do modelo não é JSON válido", e);
        }
    }

    /**
     * Anti-Pull na saída da IA (ADR-003/ADR-014, tarefa 2.2): além da proibição
     * no prompt, NENHUM template gerado passa daqui com query/conexão — mesma
     * defesa em profundidade do parser (o front revalida com o jrxml-core).
     */
    private void recusarPull(String templateJson) {
        String minusculas = templateJson.toLowerCase();
        if (minusculas.contains("querystring") || minusculas.contains("\"query\"")
                || minusculas.contains("connectionexpression")) {
            throw new PullProibido("CONTRACT_PULL_FORBIDDEN: a IA tentou embutir fonte de dados; geração recusada");
        }
    }
}
