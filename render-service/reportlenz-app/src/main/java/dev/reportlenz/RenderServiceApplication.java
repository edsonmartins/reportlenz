package dev.reportlenz;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;

/**
 * Serviço de render do ReportLenz standalone (RFC-003): preview síncrono e
 * batch assíncrono sobre a JasperReports Library 7.0.7, em modo Push (ADR-003).
 *
 * Desde o ADR-026 é SÓ o reportlenz-spring-boot-starter + configuração: nada é
 * varrido daqui (scanBasePackages aponta para um pacote vazio) — todo bean vem
 * da auto-configuração, exatamente como numa aplicação que embarca o starter.
 * Rotas na raiz: `reportlenz.api.prefixo` vazio no application.yml.
 */
@SpringBootApplication(scanBasePackages = "dev.reportlenz.app")
public class RenderServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(RenderServiceApplication.class, args);
    }

    /** Sem usuários locais: identidade só via Keycloak (evita a senha gerada do Boot). */
    @Bean
    UserDetailsService semUsuariosLocais() {
        return new InMemoryUserDetailsManager();
    }
}
