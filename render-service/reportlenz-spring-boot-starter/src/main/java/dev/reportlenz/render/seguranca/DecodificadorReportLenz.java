package dev.reportlenz.render.seguranca;

import org.springframework.security.oauth2.jwt.JwtDecoder;

/**
 * O decoder de JWT do ReportLenz, embrulhado (ADR-026 §3): um bean do tipo
 * {@link JwtDecoder} seria visto pelo resource server da APLICAÇÃO hospedeira
 * (que passaria a validar os tokens dela com o issuer do ReportLenz). Este
 * tipo próprio fica invisível para ela. Substituível pela aplicação/testes.
 *
 * @param decoder null quando o modo não é KEYCLOAK
 */
public record DecodificadorReportLenz(JwtDecoder decoder) {}
