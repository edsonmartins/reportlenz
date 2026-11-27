package dev.reportlenz.render.seguranca;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.convert.converter.Converter;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtDecoders;
import org.springframework.security.oauth2.jwt.SupplierJwtDecoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.util.matcher.RequestMatcher;

/**
 * Autenticação e autorização do render-service (ADR-017, change
 * autenticacao-keycloak/2.1-2.4).
 *
 * - Resource server JWT: tokens do realm Keycloak em `REPORTLENZ_OIDC_ISSUER`
 *   (Azure AD federado no realm). Discovery LAZY: o serviço sobe mesmo com o
 *   Keycloak momentaneamente fora; o primeiro token valida o issuer.
 * - Papéis de `realm_access.roles` e `resource_access.<client>.roles`.
 * - Actuator só na porta de management; na porta da aplicação é negado.
 * - `reportlenz.seguranca.habilitada=false` (dev) libera tudo com WARN;
 *   habilitada sem issuer → boot falha (fail-closed).
 */
@Configuration
public class ConfiguracaoDeSeguranca {

    private static final Logger log = LoggerFactory.getLogger(ConfiguracaoDeSeguranca.class);

    public static final String DESIGNER = "reportlenz-designer";
    public static final String PUBLICADOR = "reportlenz-publicador";
    public static final String BATCH = "reportlenz-batch";

    private final boolean habilitada;
    private final String issuer;
    private final String clientId;
    private final int portaDeManagement;
    /** ADR-019 §3: endereço INTERNO das chaves; o `iss` continua sendo o público. */
    private final String jwkSetUri;

    public ConfiguracaoDeSeguranca(boolean habilitada, String issuer, String clientId, int portaDeManagement) {
        this(habilitada, issuer, clientId, portaDeManagement, "");
    }

    @org.springframework.beans.factory.annotation.Autowired
    public ConfiguracaoDeSeguranca(
            @Value("${reportlenz.seguranca.habilitada:true}") boolean habilitada,
            @Value("${reportlenz.seguranca.issuer:}") String issuer,
            @Value("${reportlenz.seguranca.client-id:reportlenz}") String clientId,
            @Value("${management.server.port:-1}") int portaDeManagement,
            @Value("${reportlenz.seguranca.jwk-set-uri:}") String jwkSetUri) {
        this.jwkSetUri = jwkSetUri == null ? "" : jwkSetUri.strip();
        this.habilitada = habilitada;
        this.issuer = issuer == null ? "" : issuer.strip();
        this.clientId = clientId;
        this.portaDeManagement = portaDeManagement;
        if (habilitada && this.issuer.isEmpty()) {
            throw new IllegalStateException("Autenticação habilitada mas REPORTLENZ_OIDC_ISSUER não foi definido "
                    + "(ADR-017). Defina o issuer do realm Keycloak ou, SÓ em dev local, "
                    + "REPORTLENZ_SEGURANCA_HABILITADA=false.");
        }
    }

    @Bean
    SecurityFilterChain cadeiaDeSeguranca(HttpSecurity http) throws Exception {
        http.csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                // CORS só para as origens de REPORTLENZ_CORS_ORIGENS (ADR-025 §4); preflight antes da autorização.
                .cors(org.springframework.security.config.Customizer.withDefaults());

        if (!habilitada) {
            log.warn("[SEGURANCA] AUTENTICAÇÃO DESLIGADA (reportlenz.seguranca.habilitada=false) — "
                    + "uso exclusivo de dev local; ator da auditoria = {}", IdentidadeAtual.ATOR_DEV);
            http.authorizeHttpRequests(a -> a.anyRequest().permitAll());
            return http.build();
        }

        RequestMatcher portaDeManagementMatcher = req -> portaDeManagement > 0 && req.getLocalPort() == portaDeManagement;
        http.authorizeHttpRequests(a -> a
                        // Probes e scrape: só na porta de management (rede interna).
                        .requestMatchers(portaDeManagementMatcher).permitAll()
                        .requestMatchers("/actuator", "/actuator/**").denyAll()
                        .requestMatchers("/error").permitAll()
                        // Designer: preview, IA, verificação de gates e draft.
                        .requestMatchers(HttpMethod.POST, "/render/preview").hasAuthority(DESIGNER)
                        .requestMatchers(HttpMethod.POST, "/assist/**").hasAuthority(DESIGNER)
                        .requestMatchers(HttpMethod.POST, "/publish/verificar").hasAuthority(DESIGNER)
                        .requestMatchers(HttpMethod.POST, "/templates/*/versoes").hasAuthority(DESIGNER)
                        // Publicador: muda o status de versões (published é imutável).
                        .requestMatchers(HttpMethod.POST, "/templates/*/versoes/*/publicar").hasAuthority(PUBLICADOR)
                        .requestMatchers(HttpMethod.POST, "/templates/*/versoes/*/deprecar").hasAuthority(PUBLICADOR)
                        .requestMatchers(HttpMethod.GET, "/templates/**").hasAnyAuthority(DESIGNER, PUBLICADOR)
                        // Backend de domínio (service account): lotes.
                        .requestMatchers(HttpMethod.POST, "/render/batch").hasAuthority(BATCH)
                        .requestMatchers(HttpMethod.GET, "/render/batch/*").hasAuthority(BATCH)
                        .anyRequest().denyAll())
                .oauth2ResourceServer(o -> o.jwt(j -> j.jwtAuthenticationConverter(conversor())));
        log.info("[SEGURANCA] resource server JWT: issuer={}, jwks={}, client={}, management={}", issuer,
                jwkSetUri.isEmpty() ? "discovery" : jwkSetUri, clientId,
                portaDeManagement > 0 ? portaDeManagement : "mesma porta (actuator negado)");
        return http.build();
    }

    /** Decoder com discovery adiada (o Keycloak pode subir depois do serviço). */
    @Bean
    JwtDecoder jwtDecoder() {
        if (!habilitada) {
            return token -> {
                throw new org.springframework.security.oauth2.jwt.BadJwtException("autenticação desligada (dev)");
            };
        }
        JwtDecoder adiado;
        if (!jwkSetUri.isEmpty()) {
            // Chaves pela rede interna, mas o token TEM de ter o iss público (+ exp/nbf).
            var nimbus = org.springframework.security.oauth2.jwt.NimbusJwtDecoder.withJwkSetUri(jwkSetUri).build();
            nimbus.setJwtValidator(org.springframework.security.oauth2.jwt.JwtValidators.createDefaultWithIssuer(issuer));
            adiado = nimbus;
        } else {
            adiado = new SupplierJwtDecoder(() -> JwtDecoders.fromIssuerLocation(issuer));
        }
        return token -> {
            try {
                return adiado.decode(token);
            } catch (org.springframework.security.oauth2.jwt.BadJwtException e) {
                throw e;
            } catch (org.springframework.security.oauth2.jwt.JwtException
                    | org.springframework.security.oauth2.jwt.JwtDecoderInitializationException e) {
                // Keycloak fora do ar no discovery: 401 (não 500) e nova tentativa na
                // próxima requisição — o SupplierJwtDecoder não memoriza falhas.
                log.warn("[SEGURANCA] emissor {} indisponível para validar o token: {}", issuer, raiz(e));
                throw new org.springframework.security.oauth2.jwt.BadJwtException(
                        "emissor de identidade indisponível", e);
            }
        };
    }

    private static String raiz(Throwable e) {
        Throwable r = e;
        while (r.getCause() != null && r.getCause() != r) {
            r = r.getCause();
        }
        return r.getMessage();
    }

    /** Sem usuários locais: identidade só via Keycloak (evita a senha gerada do Boot). */
    @Bean
    UserDetailsService semUsuariosLocais() {
        return new InMemoryUserDetailsManager();
    }

    Converter<Jwt, AbstractAuthenticationToken> conversor() {
        return jwt -> new JwtAuthenticationToken(jwt, papeis(jwt, clientId), nomeDoAtor(jwt));
    }

    static String nomeDoAtor(Jwt jwt) {
        String nome = jwt.getClaimAsString("preferred_username");
        return nome != null && !nome.isBlank() ? nome : jwt.getSubject();
    }

    static Collection<GrantedAuthority> papeis(Jwt jwt, String clientId) {
        List<GrantedAuthority> papeis = new ArrayList<>();
        adicionar(papeis, jwt.getClaimAsMap("realm_access"));
        Map<String, Object> recursos = jwt.getClaimAsMap("resource_access");
        if (recursos != null && recursos.get(clientId) instanceof Map<?, ?> doCliente) {
            @SuppressWarnings("unchecked")
            Map<String, Object> mapa = (Map<String, Object>) doCliente;
            adicionar(papeis, mapa);
        }
        return papeis;
    }

    private static void adicionar(List<GrantedAuthority> destino, Map<String, Object> acesso) {
        if (acesso != null && acesso.get("roles") instanceof Collection<?> roles) {
            for (Object r : roles) {
                if (r instanceof String papel && destino.stream().noneMatch(g -> g.getAuthority().equals(papel))) {
                    destino.add(new SimpleGrantedAuthority(papel));
                }
            }
        }
    }
}
