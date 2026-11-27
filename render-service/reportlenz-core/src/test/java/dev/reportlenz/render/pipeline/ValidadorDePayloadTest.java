package dev.reportlenz.render.pipeline;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;

import dev.reportlenz.render.pipeline.ErroDeRender.PayloadForaDoContrato;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.core.type.TypeReference;

/**
 * Tarefas phase-1/4.1-4.2 — validação contra o inputSchema (2020-12) tal como
 * gerado pelo jrxml-core (buildInputSchema): agrupamento aninhado + array.
 */
class ValidadorDePayloadTest {

    private final ValidadorDePayload validador = new ValidadorDePayload();
    private final JsonMapper mapper = JsonMapper.builder().build();

    /** inputSchema como o buildInputSchema emite p/ o comprovante (RFC-002 §2). */
    private static final String INPUT_SCHEMA = """
            {
              "$schema": "https://json-schema.org/draft/2020-12/schema",
              "$id": "reportlenz:contract:comprovante:v1",
              "type": "object",
              "required": ["cliente", "itens"],
              "properties": {
                "cliente": {
                  "type": "object",
                  "required": ["nome"],
                  "properties": { "nome": { "type": "string" }, "endereco": { "type": "string" } }
                },
                "itens": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "required": ["descricao", "quantidade"],
                    "properties": { "descricao": { "type": "string" }, "quantidade": { "type": "number" } }
                  }
                }
              }
            }""";

    private Map<String, Object> schema() {
        return mapper.readValue(INPUT_SCHEMA, new TypeReference<Map<String, Object>>() {});
    }

    @Test
    void payloadQueSatisfazOContratoPassa() {
        Map<String, Object> payload = Map.of(
                "cliente", Map.of("nome", "Açougue São João"),
                "itens", List.of(Map.of("descricao", "Linguiça", "quantidade", 12.5)));
        assertThatCode(() -> validador.validar(schema(), payload)).doesNotThrowAnyException();
    }

    @Test
    void payloadForaDoContratoAcumulaTodasAsViolacoes() {
        Map<String, Object> payload = Map.of(
                // cliente sem nome; itens com quantidade string; falta nada mais
                "cliente", Map.of("endereco", "Rua X"),
                "itens", List.of(Map.of("descricao", "Linguiça", "quantidade", "doze")));

        assertThatThrownBy(() -> validador.validar(schema(), payload))
                .isInstanceOfSatisfying(PayloadForaDoContrato.class, e -> {
                    assertThat(e.violacoes()).hasSize(2);
                    assertThat(String.join("; ", e.violacoes()))
                            .contains("nome")
                            .contains("quantidade");
                });
    }
}
