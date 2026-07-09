package dev.reportlenz.render.api;

import java.util.Map;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import dev.reportlenz.render.pipeline.PipelineDeRender;
import dev.reportlenz.render.pipeline.ValidadorDePayload;
import net.sf.jasperreports.engine.JasperPrint;

/**
 * `POST /render/preview` (RFC-003 §4, tarefa phase-1/2.1): renderiza um JRXML
 * com dados de exemplo usando o MESMO engine da produção (I-8/ADR-008) e
 * devolve PDF ou PNG de uma página.
 *
 * - 200 `application/pdf` | `image/png`
 * - 400 JRXML inválido ou Pull (TratadorDeErros, tarefa 2.3)
 * - 422 sampleData fora do contrato, quando `inputSchema` acompanha o request
 *   (tarefas 4.1-4.2; o designer envia o schema gerado pelo jrxml-core)
 */
@RestController
public class PreviewController {

    private final PipelineDeRender pipeline;
    private final ValidadorDePayload validador;

    public PreviewController(PipelineDeRender pipeline, ValidadorDePayload validador) {
        this.pipeline = pipeline;
        this.validador = validador;
    }

    /**
     * @param inputSchema JSON Schema do contrato (opcional no preview; quando
     *                    presente, o sampleData é validado ANTES do render)
     * @param format      `pdf` (default) ou `png`
     * @param page        página do PNG (0-based; extensão pragmática do contrato
     *                    da RFC para o preview paginado do designer)
     */
    public record PreviewRequest(
            String jrxml,
            Map<String, Object> sampleData,
            Map<String, Object> inputSchema,
            String format,
            Integer page) {}

    @PostMapping("/render/preview")
    public ResponseEntity<byte[]> preview(@RequestBody PreviewRequest request) {
        Map<String, Object> sampleData = request.sampleData() != null ? request.sampleData() : Map.of();

        // Gate de contrato (RFC-003 §3 passo 2): valida ANTES de compilar/preencher.
        if (request.inputSchema() != null) {
            validador.validar(request.inputSchema(), sampleData);
        }

        JasperPrint print = pipeline.preencher(request.jrxml(), sampleData);

        if ("png".equalsIgnoreCase(request.format())) {
            int pagina = request.page() != null ? request.page() : 0;
            byte[] png = pipeline.exportarPng(print, pagina);
            return ResponseEntity.ok()
                    .contentType(MediaType.IMAGE_PNG)
                    .header("X-Total-Pages", String.valueOf(print.getPages().size()))
                    .body(png);
        }

        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .body(pipeline.exportarPdf(print));
    }
}
