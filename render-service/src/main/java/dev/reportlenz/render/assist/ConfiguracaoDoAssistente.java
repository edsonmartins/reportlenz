package dev.reportlenz.render.assist;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Configuração de inferência (ADR-014): OpenRouter por default; apontar
 * `baseUrl` para um endpoint OpenAI-compatível local (Ollama/vLLM) mantém a
 * inferência local como opt-in (I-4). Chave e modelo NUNCA chegam ao front.
 */
@ConfigurationProperties(prefix = "reportlenz.assist")
public record ConfiguracaoDoAssistente(String baseUrl, String apiKey, String model, Double temperature) {

    public ConfiguracaoDoAssistente {
        if (baseUrl == null || baseUrl.isBlank()) baseUrl = "https://openrouter.ai/api/v1";
        if (model == null || model.isBlank()) model = "openai/gpt-4o-mini";
        if (temperature == null) temperature = 0.2;
    }

    public boolean configurado() {
        return apiKey != null && !apiKey.isBlank();
    }
}
