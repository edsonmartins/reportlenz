package dev.reportlenz.render.seguranca;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.security.oauth2.jwt.JwtDecoder;

/**
 * Nos testes, o decoder do ReportLenz é o JwtDecoder mockado do teste
 * (@MockitoBean): cada "token" opaco mapeia para um Jwt com as claims que o
 * Keycloak emitiria. O starter respeita (@ConditionalOnMissingBean).
 */
@TestConfiguration
public class DecodificadorDeTeste {

    @Bean
    DecodificadorReportLenz decodificadorReportLenz(JwtDecoder decoder) {
        return new DecodificadorReportLenz(decoder);
    }
}
