package com.empresa.pedidos;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.Jwt;

import dev.reportlenz.render.seguranca.DecodificadorReportLenz;

/**
 * O que a aplicação faria nos próprios testes: substituir o decoder do
 * ReportLenz (tipo próprio do starter — não é um bean JwtDecoder) por um que
 * aceita tokens fixos com os papéis do ADR-017.
 */
@TestConfiguration
class TokensDeTeste {

    static final String DESIGNER = "tok-designer";

    @Bean
    DecodificadorReportLenz decodificadorReportLenz() {
        return new DecodificadorReportLenz(token -> {
            if (!DESIGNER.equals(token)) throw new BadJwtException("token inválido");
            return Jwt.withTokenValue(token).header("alg", "RS256").subject("u1")
                    .claim("preferred_username", "ana.designer")
                    .claim("realm_access", Map.of("roles", List.of("reportlenz-designer", "reportlenz-publicador")))
                    .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(300)).build();
        });
    }
}
