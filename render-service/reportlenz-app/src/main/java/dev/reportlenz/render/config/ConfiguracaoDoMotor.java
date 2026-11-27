package dev.reportlenz.render.config;

import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import dev.reportlenz.render.pipeline.CacheDeCompilacao;
import dev.reportlenz.render.pipeline.CacheDeCompilacaoEmMemoria;
import dev.reportlenz.render.pipeline.CompiladorJrxml;
import dev.reportlenz.render.pipeline.ContextoJasperRestrito;
import dev.reportlenz.render.pipeline.PipelineDeRender;
import dev.reportlenz.render.pipeline.ResolvedorDeSubreports;
import dev.reportlenz.render.pipeline.ValidadorDePayload;
import dev.reportlenz.render.publish.VerificadorDeGates;
import io.micrometer.observation.ObservationRegistry;

/**
 * Liga o núcleo (reportlenz-core, Java puro — ADR-026) ao contexto Spring:
 * as classes do núcleo não têm anotações; os beans são declarados aqui, com
 * as peças que dependem de infraestrutura (subreports pelo registro JDBC,
 * cache compartilhado no Redis — @Primary quando ligado).
 */
@Configuration
public class ConfiguracaoDoMotor {

    @Bean
    CompiladorJrxml compiladorJrxml() {
        return new CompiladorJrxml();
    }

    @Bean
    CacheDeCompilacaoEmMemoria cacheDeCompilacaoEmMemoria() {
        return new CacheDeCompilacaoEmMemoria();
    }

    @Bean
    ContextoJasperRestrito contextoJasperRestrito(
            @Value("${reportlenz.recursos.urls-permitidas:}") List<String> urlsPermitidas,
            ResolvedorDeSubreports subreports) {
        return new ContextoJasperRestrito(urlsPermitidas, subreports::compilar);
    }

    @Bean
    PipelineDeRender pipelineDeRender(CompiladorJrxml compilador, CacheDeCompilacao cache,
            ObservationRegistry observacoes, ContextoJasperRestrito recursos) {
        return new PipelineDeRender(compilador, cache, observacoes, recursos);
    }

    @Bean
    ValidadorDePayload validadorDePayload() {
        return new ValidadorDePayload();
    }

    @Bean
    VerificadorDeGates verificadorDeGates(CompiladorJrxml compilador, ResolvedorDeSubreports subreports) {
        return new VerificadorDeGates(compilador, subreports);
    }
}
