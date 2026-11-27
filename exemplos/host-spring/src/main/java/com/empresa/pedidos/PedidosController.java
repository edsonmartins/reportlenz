package com.empresa.pedidos;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import dev.reportlenz.render.motor.MotorReportLenz;

/**
 * Rotas DA APLICAÇÃO. O comprovante usa o motor do ReportLenz pela API Java
 * (ADR-026 §2): a aplicação monta o payload (Push) com os próprios dados e
 * pede o PDF — sem HTTP, sem render-service separado.
 */
@RestController
public class PedidosController {

    private final MotorReportLenz motor;
    private final JdbcClient jdbc;
    private final String comprovante;

    public PedidosController(MotorReportLenz motor, JdbcClient jdbc) throws IOException {
        this.motor = motor;
        this.jdbc = jdbc;
        try (InputStream in = getClass().getResourceAsStream("/relatorios/comprovante.jrxml")) {
            this.comprovante = new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    @GetMapping("/api/publico/ping")
    Map<String, String> ping() {
        return Map.of("status", "ok");
    }

    @GetMapping("/api/pedidos/quantidade")
    Map<String, Long> quantidade() {
        return Map.of("pedidos", jdbc.sql("SELECT count(*) FROM pedido").query(Long.class).single());
    }

    @GetMapping(value = "/api/pedidos/{id}/comprovante.pdf", produces = MediaType.APPLICATION_PDF_VALUE)
    ResponseEntity<byte[]> comprovante(@PathVariable long id) {
        Map<String, Object> pedido = jdbc.sql("SELECT id, cliente, valor FROM pedido WHERE id = ?").param(id).query().singleRow();
        return ResponseEntity.ok(motor.renderizarPdf(comprovante, Map.of(
                "numero", String.valueOf(pedido.get("id")),
                "cliente", (String) pedido.get("cliente"),
                "valor", ((Number) pedido.get("valor")).doubleValue())));
    }
}
