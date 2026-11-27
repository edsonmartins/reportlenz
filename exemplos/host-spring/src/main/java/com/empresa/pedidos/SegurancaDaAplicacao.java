package com.empresa.pedidos;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;

/**
 * A segurança DA APLICAÇÃO (não do ReportLenz): HTTP Basic, /api/publico
 * aberto e o resto autenticado. Ativa no perfil "com-seguranca-propria"; sem
 * ele, a aplicação depende da segurança padrão do Spring Boot.
 */
@Configuration
@Profile("com-seguranca-propria")
public class SegurancaDaAplicacao {

    @Bean
    SecurityFilterChain cadeiaDaAplicacao(HttpSecurity http) throws Exception {
        http.authorizeHttpRequests(a -> a
                        .requestMatchers("/api/publico/**").permitAll()
                        .anyRequest().authenticated())
                .httpBasic(Customizer.withDefaults())
                .csrf(c -> c.disable());
        return http.build();
    }

    @Bean
    UserDetailsService usuariosDaAplicacao() {
        return new InMemoryUserDetailsManager(User.withUsername("operador").password("{noop}senha-de-teste").roles("OPERADOR").build());
    }
}
