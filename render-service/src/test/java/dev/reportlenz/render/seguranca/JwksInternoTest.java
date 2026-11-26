package dev.reportlenz.render.seguranca;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.sun.net.httpserver.HttpServer;

/**
 * Issuer público × JWKS interno (ADR-019 §3, change empacotamento-deploy/2.1):
 * chaves buscadas no endereço interno, mas assinatura, expiração e `iss`
 * público continuam obrigatórios. Usa chave RSA e JWKS reais (servidor local).
 */
class JwksInternoTest {

    private static final String ISSUER_PUBLICO = "http://localhost:8180/realms/reportlenz";

    private HttpServer jwks;
    private KeyPair chave;
    private String jwksUri;

    @BeforeEach
    void subirJwks() throws Exception {
        KeyPairGenerator gerador = KeyPairGenerator.getInstance("RSA");
        gerador.initialize(2048);
        chave = gerador.generateKeyPair();
        RSAKey publica = new RSAKey.Builder((RSAPublicKey) chave.getPublic()).keyID("k1").build();
        byte[] corpo = new JWKSet(publica).toString().getBytes(StandardCharsets.UTF_8);
        jwks = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        jwks.createContext("/certs", troca -> {
            troca.getResponseHeaders().add("Content-Type", "application/json");
            troca.sendResponseHeaders(200, corpo.length);
            troca.getResponseBody().write(corpo);
            troca.close();
        });
        jwks.start();
        jwksUri = "http://127.0.0.1:" + jwks.getAddress().getPort() + "/certs";
    }

    @AfterEach
    void derrubar() {
        jwks.stop(0);
    }

    private String token(String iss, Instant exp, KeyPair assinante) throws Exception {
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
                .issuer(iss).subject("u1").claim("preferred_username", "publicador.homolog")
                .claim("realm_access", Map.of("roles", List.of(ConfiguracaoDeSeguranca.PUBLICADOR)))
                .issueTime(new Date()).expirationTime(Date.from(exp)).build();
        SignedJWT jwt = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.RS256).keyID("k1").build(), claims);
        jwt.sign(new RSASSASigner((RSAPrivateKey) assinante.getPrivate()));
        return jwt.serialize();
    }

    private JwtDecoder decoder() {
        return new ConfiguracaoDeSeguranca(true, ISSUER_PUBLICO, "reportlenz", -1, jwksUri).jwtDecoder();
    }

    @Test
    void cenarioDoSpec_tokenValidoDoRealm() throws Exception {
        Jwt jwt = decoder().decode(token(ISSUER_PUBLICO, Instant.now().plusSeconds(300), chave));
        assertThat(ConfiguracaoDeSeguranca.nomeDoAtor(jwt)).isEqualTo("publicador.homolog");
        assertThat(ConfiguracaoDeSeguranca.papeis(jwt, "reportlenz"))
                .extracting(Object::toString).contains(ConfiguracaoDeSeguranca.PUBLICADOR);
    }

    @Test
    void cenarioDoSpec_tokenDeOutroIssuerERecusado() throws Exception {
        String outro = token("http://keycloak:8080/realms/outro", Instant.now().plusSeconds(300), chave);
        assertThatThrownBy(() -> decoder().decode(outro)).isInstanceOf(BadJwtException.class);
    }

    @Test
    void tokenExpiradoERecusado() throws Exception {
        String expirado = token(ISSUER_PUBLICO, Instant.now().minusSeconds(600), chave);
        assertThatThrownBy(() -> decoder().decode(expirado)).isInstanceOf(BadJwtException.class);
    }

    @Test
    void tokenAssinadoPorOutraChaveERecusado() throws Exception {
        KeyPairGenerator gerador = KeyPairGenerator.getInstance("RSA");
        gerador.initialize(2048);
        String forjado = token(ISSUER_PUBLICO, Instant.now().plusSeconds(300), gerador.generateKeyPair());
        assertThatThrownBy(() -> decoder().decode(forjado)).isInstanceOf(BadJwtException.class);
    }

    @Test
    void jwksForaDoArViraTokenInvalidoNao500() throws Exception {
        String valido = token(ISSUER_PUBLICO, Instant.now().plusSeconds(300), chave);
        jwks.stop(0);
        assertThatThrownBy(() -> decoder().decode(valido)).isInstanceOf(BadJwtException.class);
    }
}
