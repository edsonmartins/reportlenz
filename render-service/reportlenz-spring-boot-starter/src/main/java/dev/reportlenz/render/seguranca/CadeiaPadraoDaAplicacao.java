package dev.reportlenz.render.seguranca;

import java.util.Arrays;

import org.springframework.beans.factory.config.ConfigurableListableBeanFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Condition;
import org.springframework.context.annotation.ConditionContext;
import org.springframework.context.annotation.Conditional;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.core.type.AnnotatedTypeMetadata;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Proteção da APLICAÇÃO hospedeira preservada (ADR-026 §3).
 *
 * O Spring Boot só cria a cadeia de segurança padrão (tudo autenticado,
 * form login + basic) quando NÃO existe nenhuma SecurityFilterChain. A cadeia
 * do ReportLenz existiria — e as rotas da aplicação ficariam SEM proteção.
 * Quando a aplicação não declarou cadeia própria, esta reproduz a padrão do
 * Boot com a menor precedência (a do ReportLenz, escopada ao prefixo, vem
 * antes). Se a aplicação tem cadeia, nada é registrado.
 */
@Configuration
@Conditional(CadeiaPadraoDaAplicacao.SemCadeiaDaAplicacao.class)
public class CadeiaPadraoDaAplicacao {

    @Bean
    @Order(Ordered.LOWEST_PRECEDENCE)
    SecurityFilterChain cadeiaPadraoDaAplicacao(HttpSecurity http) throws Exception {
        http.authorizeHttpRequests(a -> a.anyRequest().authenticated())
                .formLogin(Customizer.withDefaults())
                .httpBasic(Customizer.withDefaults());
        return http.build();
    }

    /** Embarcado (prefixo não vazio) e nenhuma SecurityFilterChain da aplicação. */
    static class SemCadeiaDaAplicacao implements Condition {
        @Override
        public boolean matches(ConditionContext contexto, AnnotatedTypeMetadata metadados) {
            String prefixo = PrefixoDaApi.normalizar(contexto.getEnvironment().getProperty("reportlenz.api.prefixo", "/reportlenz"));
            if (prefixo.isEmpty()) {
                return false; // standalone: a cadeia do ReportLenz cobre /**
            }
            ConfigurableListableBeanFactory fabrica = contexto.getBeanFactory();
            if (fabrica == null) return false;
            return Arrays.stream(fabrica.getBeanNamesForType(SecurityFilterChain.class, true, false))
                    .noneMatch(nome -> !nome.equals(ConfiguracaoDeSeguranca.NOME_DA_CADEIA)
                            && !nome.equals("cadeiaPadraoDaAplicacao"));
        }
    }
}
