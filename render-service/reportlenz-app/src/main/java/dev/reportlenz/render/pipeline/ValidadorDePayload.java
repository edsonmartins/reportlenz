package dev.reportlenz.render.pipeline;

import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Component;

import com.networknt.schema.Error;
import com.networknt.schema.InputFormat;
import com.networknt.schema.Schema;
import com.networknt.schema.SchemaRegistry;
import com.networknt.schema.SpecificationVersion;

import dev.reportlenz.render.pipeline.ErroDeRender.PayloadForaDoContrato;
import tools.jackson.databind.json.JsonMapper;

/**
 * Gate de contrato em runtime (RFC-002 §5, tarefas phase-1/4.1-4.2): valida o
 * payload contra o `inputSchema` (JSON Schema 2020-12 gerado pelo jrxml-core)
 * ANTES de qualquer render. Payload inválido → `PayloadForaDoContrato` (422
 * com a lista de violações) e o pipeline nem é acionado.
 */
@Component
public class ValidadorDePayload {

    private final SchemaRegistry registry = SchemaRegistry.withDefaultDialect(SpecificationVersion.DRAFT_2020_12);
    private final JsonMapper mapper = JsonMapper.builder().build();

    /**
     * @param inputSchema o JSON Schema da versão do template (objeto já
     *                    desserializado — vem do request no preview, do
     *                    registro da versão no batch/ADR-009)
     * @param payload     o payload Push a validar
     */
    public void validar(Map<String, Object> inputSchema, Map<String, Object> payload) {
        Schema schema = registry.getSchema(mapper.writeValueAsString(inputSchema));
        List<Error> erros = schema.validate(mapper.writeValueAsString(payload), InputFormat.JSON);
        if (!erros.isEmpty()) {
            List<String> violacoes = erros.stream()
                    .map(e -> e.getInstanceLocation() + ": " + e.getMessage())
                    .toList();
            throw new PayloadForaDoContrato(violacoes);
        }
    }
}
