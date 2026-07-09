package dev.reportlenz.render.api;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import dev.reportlenz.render.pipeline.ErroDeRender;

/**
 * Mapeamento HTTP dos erros do pipeline (RFC-003 §4, tarefa phase-1/2.3):
 * - 400: JRXML inválido ou Pull (`CONTRACT_PULL_FORBIDDEN`) — erro do template;
 * - 500: falha de fill/export — erro do serviço;
 * - 422 (payload × inputSchema) chega com as tarefas 4.x.
 */
@RestControllerAdvice
public class TratadorDeErros {

    /** Corpo de erro estruturado, alinhado aos códigos do jrxml-core. */
    public record ErroResponse(String codigo, String mensagem) {}

    @ExceptionHandler(ErroDeRender.PullProibido.class)
    public ResponseEntity<ErroResponse> pullProibido(ErroDeRender.PullProibido e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ErroResponse("CONTRACT_PULL_FORBIDDEN", e.getMessage()));
    }

    @ExceptionHandler(ErroDeRender.JrxmlInvalido.class)
    public ResponseEntity<ErroResponse> jrxmlInvalido(ErroDeRender.JrxmlInvalido e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ErroResponse("JRXML_INVALIDO", e.getMessage()));
    }

    @ExceptionHandler(ErroDeRender.FalhaDeRender.class)
    public ResponseEntity<ErroResponse> falhaDeRender(ErroDeRender.FalhaDeRender e) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(new ErroResponse("FALHA_DE_RENDER", e.getMessage()));
    }

    /** Corpo do 422: a lista de violações do inputSchema (RFC-002 §5). */
    public record ErroValidacaoResponse(String codigo, String mensagem, java.util.List<String> violacoes) {}

    @ExceptionHandler(ErroDeRender.PayloadForaDoContrato.class)
    public ResponseEntity<ErroValidacaoResponse> payloadForaDoContrato(ErroDeRender.PayloadForaDoContrato e) {
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                .body(new ErroValidacaoResponse("PAYLOAD_FORA_DO_CONTRATO", e.getMessage(), e.violacoes()));
    }
}
