package dev.reportlenz.render.assist;

import java.util.List;
import java.util.Map;

import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import dev.reportlenz.render.assist.ErroDoAssistente.IaIndisponivel;
import dev.reportlenz.render.assist.ErroDoAssistente.RespostaInvalida;

/**
 * Cliente do provedor de inferência (ADR-014): protocolo OpenAI-compatível
 * (`/chat/completions`) — funciona com OpenRouter (default) e com endpoints
 * locais (Ollama/vLLM) trocando só a base-url. Sem streaming (padrão
 * request/response do copiloto do mentors-ipaas-admin).
 */
@Component
public class ClienteDeInferencia {

    private final ConfiguracaoDoAssistente config;
    private final RestClient http;

    public ClienteDeInferencia(ConfiguracaoDoAssistente config) {
        this.config = config;
        this.http = RestClient.builder().baseUrl(config.baseUrl()).build();
    }

    public ConfiguracaoDoAssistente config() {
        return config;
    }

    /** Uma rodada de chat (sistema + usuário) → conteúdo da resposta do modelo. */
    @SuppressWarnings("unchecked")
    public String completar(String sistema, String usuario) {
        if (!config.configurado()) {
            throw new IaIndisponivel("assistente sem chave configurada (OPENROUTER_API_KEY)");
        }
        Map<String, Object> corpo = Map.of(
                "model", config.model(),
                "temperature", config.temperature(),
                "max_tokens", config.maxTokens(),
                // Saída SEMPRE JSON (spike 1.1: sem isso o modelo intercala prosa).
                "response_format", Map.of("type", "json_object"),
                // Reasoning desligado (spike 1.1): em modelos com thinking os
                // tokens de raciocínio consomem o max_tokens e TRUNCAM o JSON.
                "reasoning", Map.of("enabled", false),
                "messages", List.of(
                        Map.of("role", "system", "content", sistema),
                        Map.of("role", "user", "content", usuario)));
        Map<String, Object> resposta;
        try {
            resposta = http.post()
                    .uri("/chat/completions")
                    .contentType(MediaType.APPLICATION_JSON)
                    .header("Authorization", "Bearer " + config.apiKey())
                    .body(corpo)
                    .retrieve()
                    .body(Map.class);
        } catch (Exception e) {
            throw new IaIndisponivel("provedor de inferência indisponível: " + e.getMessage(), e);
        }
        try {
            List<Map<String, Object>> choices = (List<Map<String, Object>>) resposta.get("choices");
            Map<String, Object> mensagem = (Map<String, Object>) choices.get(0).get("message");
            return (String) mensagem.get("content");
        } catch (RuntimeException e) {
            throw new RespostaInvalida("resposta do provedor fora do formato chat/completions", e);
        }
    }
}
