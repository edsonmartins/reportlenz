package dev.reportlenz.render.config;

import java.util.List;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import dev.reportlenz.render.motor.MotorReportLenz;
import dev.reportlenz.render.pipeline.CacheDeCompilacao;
import dev.reportlenz.render.pipeline.CacheDeCompilacaoEmMemoria;
import dev.reportlenz.render.pipeline.CompiladorJrxml;
import dev.reportlenz.render.pipeline.ContextoJasperRestrito;
import dev.reportlenz.render.pipeline.FonteDeSubreports;
import dev.reportlenz.render.pipeline.PipelineDeRender;
import dev.reportlenz.render.pipeline.ResolvedorDeSubreports;
import dev.reportlenz.render.pipeline.ValidadorDePayload;
import dev.reportlenz.render.publish.VerificadorDeGates;
import io.micrometer.observation.ObservationRegistry;

/**
 * Liga o núcleo (reportlenz-core, Java puro — ADR-026) ao contexto Spring.
 * Toda peça é {@code @ConditionalOnMissingBean}: a aplicação pode substituir
 * (ex.: o próprio CacheDeCompilacao ou uma FonteDeSubreports). Subreports
 * vêm do registro (ResolvedorDeSubreports) quando ele está habilitado.
 */
@Configuration
public class ConfiguracaoDoMotor {

    @Bean
    @ConditionalOnMissingBean
    CompiladorJrxml compiladorJrxml() {
        return new CompiladorJrxml();
    }

    @Bean
    @ConditionalOnMissingBean(CacheDeCompilacao.class)
    CacheDeCompilacaoEmMemoria cacheDeCompilacaoEmMemoria() {
        return new CacheDeCompilacaoEmMemoria();
    }

    @Bean
    @ConditionalOnMissingBean
    ContextoJasperRestrito contextoJasperRestrito(
            @Value("${reportlenz.recursos.urls-permitidas:}") List<String> urlsPermitidas,
            ObjectProvider<ResolvedorDeSubreports> registro) {
        ResolvedorDeSubreports resolvedor = registro.getIfAvailable();
        return new ContextoJasperRestrito(urlsPermitidas, resolvedor == null ? null : resolvedor::compilar);
    }

    @Bean
    @ConditionalOnMissingBean
    PipelineDeRender pipelineDeRender(CompiladorJrxml compilador, CacheDeCompilacao cache,
            ObjectProvider<ObservationRegistry> observacoes, ContextoJasperRestrito recursos) {
        return new PipelineDeRender(compilador, cache, observacoes.getIfAvailable(() -> ObservationRegistry.NOOP), recursos);
    }

    @Bean
    @ConditionalOnMissingBean
    ValidadorDePayload validadorDePayload() {
        return new ValidadorDePayload();
    }

    @Bean
    @ConditionalOnMissingBean
    VerificadorDeGates verificadorDeGates(CompiladorJrxml compilador, ObjectProvider<FonteDeSubreports> subreports) {
        return new VerificadorDeGates(compilador, subreports.getIfAvailable());
    }

    /**
     * A fachada do núcleo como bean (ADR-026 §2): a aplicação injeta e
     * renderiza PDF/PNG pela API Java — com o mesmo cache, URLs permitidas e
     * subreports do registro que os endpoints usam.
     */
    @Bean
    @ConditionalOnMissingBean
    MotorReportLenz motorReportLenz(@Value("${reportlenz.recursos.urls-permitidas:}") List<String> urlsPermitidas,
            CacheDeCompilacao cache, ObjectProvider<FonteDeSubreports> subreports,
            ObjectProvider<ObservationRegistry> observacoes) {
        return MotorReportLenz.builder()
                .urlsPermitidas(urlsPermitidas.stream().filter(u -> !u.isBlank()).toList())
                .cache(cache)
                .subreports(subreports.getIfAvailable())
                .observacoes(observacoes.getIfAvailable(() -> ObservationRegistry.NOOP))
                .build();
    }
}
