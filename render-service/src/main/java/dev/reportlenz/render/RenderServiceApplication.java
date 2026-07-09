package dev.reportlenz.render;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Serviço de render do ReportLenz (RFC-003): preview síncrono e batch
 * assíncrono sobre a JasperReports Library 7.0.7, em modo Push (ADR-003) —
 * o payload chega pronto e validado contra o contrato; nunca há query
 * embutida nem acesso a fonte de dados na origem (I-2).
 */
@SpringBootApplication
public class RenderServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(RenderServiceApplication.class, args);
    }
}
