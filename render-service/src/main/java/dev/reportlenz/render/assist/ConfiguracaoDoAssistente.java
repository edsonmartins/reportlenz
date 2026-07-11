package dev.reportlenz.render.assist;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Configuração de inferência (ADR-014): OpenRouter por default; apontar
 * `baseUrl` para um endpoint OpenAI-compatível local (Ollama/vLLM) mantém a
 * inferência local como opt-in (I-4). Chave e modelo NUNCA chegam ao front.
 */
@ConfigurationProperties(prefix = "reportlenz.assist")
public record ConfiguracaoDoAssistente(String baseUrl, String apiKey, String model, Double temperature, Integer maxTokens) {

    public ConfiguracaoDoAssistente {
        if (baseUrl == null || baseUrl.isBlank()) baseUrl = "https://openrouter.ai/api/v1";
        if (model == null || model.isBlank()) model = "google/gemini-2.5-flash";
        if (temperature == null) temperature = 0.2;
        // Um ReportTemplate JSON completo passa fácil de 2k tokens — sem teto
        // explícito o default do provedor TRUNCA e o JSON quebra (achado do
        // spike phase-4/1.1).
        if (maxTokens == null) maxTokens = 16000;
    }

    public boolean configurado() {
        return apiKey != null && !apiKey.isBlank();
    }
}
