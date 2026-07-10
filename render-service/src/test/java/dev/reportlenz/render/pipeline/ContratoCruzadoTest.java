package dev.reportlenz.render.pipeline;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;

import dev.reportlenz.render.pipeline.ErroDeRender.PayloadForaDoContrato;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/**
 * Teste CRUZADO de contrato (aceite da Fase 1, RFC-002 §7): o inputSchema
 * gerado pelo jrxml-core (TypeScript, buildInputSchema) é consumido pelo
 * validador do serviço (networknt, Java) — as duas pontas falam o mesmo
 * JSON Schema 2020-12.
 *
 * Roda quando os fixtures existem (pnpm emit:fixtures no jrxml-core).
 */
class ContratoCruzadoTest {

    private static final Path SCHEMA_COMPROVANTE =
            Path.of("../tools/jr7-harness/fixtures/comprovante.schema.json");

    static boolean fixturesDisponiveis() {
        return Files.exists(SCHEMA_COMPROVANTE);
    }

    @Test
    @EnabledIf("fixturesDisponiveis")
    void schemaGeradoPeloCoreEhAplicadoPeloValidadorDoServico() throws Exception {
        JsonMapper mapper = JsonMapper.builder().build();
        Map<String, Object> schema = mapper.readValue(
                Files.readString(SCHEMA_COMPROVANTE), new TypeReference<Map<String, Object>>() {});
        assertThat(schema.get("$id")).isEqualTo("reportlenz:contract:comprovante:v1");

        ValidadorDePayload validador = new ValidadorDePayload();

        // Payload no formato do contrato do comprovante (agrupado pela heurística do core).
        Map<String, Object> valido = Map.of(
                "pedido", Map.of("numero", "P-42", "data", "2026-07-10", "qrPayload", "qr-xyz"),
                "cliente", Map.of("nome", "Açougue São João", "documento", "12.345.678/0001-99", "endereco", "Rua X"),
                "itens", List.of(Map.of("descricao", "Linguiça", "quantidade", 12.5, "unidade", "kg")));
        assertThatCode(() -> validador.validar(schema, valido)).doesNotThrowAnyException();

        // Tipo errado no item: o validador Java recusa com base no schema do core TS.
        Map<String, Object> invalido = Map.of(
                "pedido", Map.of("numero", "P-42", "data", "2026-07-10", "qrPayload", "qr"),
                "cliente", Map.of("nome", "X", "documento", "Y"),
                "itens", List.of(Map.of("descricao", "Linguiça", "quantidade", "doze")));
        assertThatThrownBy(() -> validador.validar(schema, invalido))
                .isInstanceOfSatisfying(PayloadForaDoContrato.class,
                        e -> assertThat(String.join("; ", e.violacoes())).contains("quantidade"));
    }
}
