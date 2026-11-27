package dev.reportlenz.render.seguranca;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * CORS para o componente React embutido (ADR-025 §4): quando a aplicação
 * hospedeira usa `apiBaseUrl` de OUTRA origem, só as origens listadas em
 * `REPORTLENZ_CORS_ORIGENS` (vírgula) recebem os cabeçalhos CORS. Lista
 * vazia (default) = sem CORS — o designer fala por proxy na mesma origem.
 *
 * Sem credenciais de cookie: a autenticação é Bearer (stateless).
 */
@Configuration
public class ConfiguracaoDeCors {

    private static final Logger log = LoggerFactory.getLogger(ConfiguracaoDeCors.class);

    /** O nome importa: é o bean que `http.cors(withDefaults())` do Spring Security procura. */
    @Bean(name = "corsConfigurationSource")
    CorsConfigurationSource fonteDeCors(@Value("${reportlenz.cors.origens-permitidas:}") List<String> origens) {
        List<String> permitidas = origens.stream().map(String::strip).filter(o -> !o.isEmpty()).toList();
        UrlBasedCorsConfigurationSource fonte = new UrlBasedCorsConfigurationSource();
        if (permitidas.isEmpty()) {
            return fonte; // nenhuma origem externa: requisição cross-origin não recebe cabeçalhos CORS
        }
        if (permitidas.contains("*")) {
            throw new IllegalStateException("REPORTLENZ_CORS_ORIGENS não aceita '*': liste as origens das aplicações (ADR-025 §4).");
        }
        CorsConfiguration cors = new CorsConfiguration();
        cors.setAllowedOrigins(permitidas);
        cors.setAllowedMethods(List.of("GET", "POST", "OPTIONS"));
        cors.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        // O preview informa o total de páginas por cabeçalho.
        cors.setExposedHeaders(List.of("X-Total-Pages"));
        cors.setAllowCredentials(false);
        cors.setMaxAge(600L);
        fonte.registerCorsConfiguration("/**", cors);
        log.info("[CORS] origens permitidas: {}", permitidas);
        return fonte;
    }
}
