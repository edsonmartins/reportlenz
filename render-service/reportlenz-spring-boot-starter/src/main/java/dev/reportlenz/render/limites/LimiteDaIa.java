package dev.reportlenz.render.limites;

import dev.reportlenz.render.config.RecursoAssistente;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import dev.reportlenz.render.seguranca.IdentidadeAtual;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Rate limit da IA por usuário (ADR-018 §3): janela fixa de 1 minuto no Redis
 * (vale entre instâncias), chave = ator do token (ADR-017). Acima do limite →
 * 429 `IA_LIMITE_EXCEDIDO` + `Retry-After`, SEM chamar o provedor pago.
 * Redis indisponível → deixa passar (fail-open: o limite protege custo, não
 * segurança — a autenticação já foi exigida antes).
 */
@Configuration
@RecursoAssistente
public class LimiteDaIa implements HandlerInterceptor, WebMvcConfigurer {

    private static final Logger log = LoggerFactory.getLogger(LimiteDaIa.class);

    private final StringRedisTemplate redis;
    private final int limitePorMinuto;
    private final String prefixo;

    @Value("${reportlenz.api.prefixo:/reportlenz}")
    void prefixoDaApi(String prefixo) {
        this.prefixoDaApi = dev.reportlenz.render.seguranca.PrefixoDaApi.normalizar(prefixo);
    }

    private String prefixoDaApi = "";

    public LimiteDaIa(StringRedisTemplate redis,
            @Value("${reportlenz.assist.limite-por-minuto:10}") int limitePorMinuto,
            @Value("${reportlenz.assist.limite-prefixo:reportlenz:assist:limite:}") String prefixo) {
        this.redis = redis;
        this.limitePorMinuto = limitePorMinuto;
        this.prefixo = prefixo;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // ADR-026 §3: as rotas da IA ficam sob o prefixo da API do ReportLenz.
        registry.addInterceptor(this).addPathPatterns(prefixoDaApi + "/assist/**");
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        if (limitePorMinuto <= 0) {
            return true; // 0 = sem limite
        }
        long agora = Instant.now().getEpochSecond();
        long minuto = agora / 60;
        String chave = prefixo + IdentidadeAtual.ator() + ":" + minuto;
        Long contagem;
        try {
            contagem = redis.opsForValue().increment(chave);
            if (contagem != null && contagem == 1) {
                redis.expire(chave, Duration.ofSeconds(120));
            }
        } catch (RuntimeException e) {
            log.warn("[IA] rate limit indisponível (Redis): {} — chamada liberada", e.getMessage());
            return true;
        }
        if (contagem != null && contagem > limitePorMinuto) {
            long retry = Math.max(1, (minuto + 1) * 60 - agora);
            response.setStatus(429);
            response.setHeader("Retry-After", String.valueOf(retry));
            response.setContentType("application/json");
            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
            response.getWriter().write("{\"codigo\":\"IA_LIMITE_EXCEDIDO\",\"mensagem\":\"limite de "
                    + limitePorMinuto + " chamadas por minuto ao assistente atingido; tente em " + retry + "s\"}");
            return false;
        }
        return true;
    }
}
