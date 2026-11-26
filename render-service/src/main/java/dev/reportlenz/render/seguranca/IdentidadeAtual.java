package dev.reportlenz.render.seguranca;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

/**
 * Ator da auditoria (ADR-017 §3, RFC-006 §4): SEMPRE a identidade do token —
 * `preferred_username` (fallback `sub`). Nenhum `actor` vindo do corpo da
 * requisição é aceito. Com a autenticação desligada (dev local) o ator é
 * {@link #ATOR_DEV}.
 */
public final class IdentidadeAtual {

    public static final String ATOR_DEV = "dev-local";

    private IdentidadeAtual() {}

    public static String ator() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth instanceof JwtAuthenticationToken token) {
            return token.getName();
        }
        return ATOR_DEV;
    }
}
