package dev.reportlenz.render.config;

import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.AutoConfigurationExcludeFilter;
import org.springframework.boot.context.TypeExcludeFilter;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.FilterType;
import org.springframework.web.method.HandlerTypePredicate;
import org.springframework.web.servlet.config.annotation.PathMatchConfigurer;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import dev.reportlenz.render.api.TratadorDeErros;
import dev.reportlenz.render.assist.ConfiguracaoDoAssistente;
import dev.reportlenz.render.seguranca.PrefixoDaApi;
import dev.reportlenz.render.storage.ArmazenamentoProperties;

/**
 * Auto-configuração do ReportLenz (ADR-026 §3): importar
 * {@code reportlenz-spring-boot-starter} numa aplicação Spring Boot 4 sobe o
 * motor de render, o registro de templates, os endpoints do designer, o
 * batch e a IA — cada recurso desligável por propriedade
 * ({@code reportlenz.registro|batch|assistente.habilitado}).
 *
 * <ul>
 *   <li>Rotas sob {@code reportlenz.api.prefixo} (default {@code /reportlenz});
 *       o render-service standalone usa prefixo vazio.</li>
 *   <li>Segurança, filtro de 413, tratador de erros e CORS escopados ao prefixo;
 *       Flyway em tabela própria; agendador próprio — nada disso vaza para a
 *       aplicação.</li>
 *   <li>Peças do motor substituíveis ({@code @ConditionalOnMissingBean}).</li>
 * </ul>
 */
@AutoConfiguration
@ComponentScan(basePackages = "dev.reportlenz.render", excludeFilters = {
        // Mesmos filtros do @SpringBootApplication: @TestConfiguration e auto-configs ficam de fora.
        @ComponentScan.Filter(type = FilterType.CUSTOM, classes = TypeExcludeFilter.class),
        @ComponentScan.Filter(type = FilterType.CUSTOM, classes = AutoConfigurationExcludeFilter.class),
        @ComponentScan.Filter(type = FilterType.ASSIGNABLE_TYPE, classes = ReportLenzAutoConfiguration.class)})
@EnableConfigurationProperties({ArmazenamentoProperties.class, ConfiguracaoDoAssistente.class})
public class ReportLenzAutoConfiguration {

    /** Prefixo de rota só para os controllers do ReportLenz. */
    @Bean
    WebMvcConfigurer prefixoDaApiDoReportLenz(
            @org.springframework.beans.factory.annotation.Value("${reportlenz.api.prefixo:/reportlenz}") String prefixo) {
        String p = PrefixoDaApi.normalizar(prefixo);
        return new WebMvcConfigurer() {
            @Override
            public void configurePathMatch(PathMatchConfigurer configurer) {
                if (!p.isEmpty()) {
                    configurer.addPathPrefix(p, HandlerTypePredicate.forBasePackageClass(TratadorDeErros.class));
                }
            }
        };
    }
}
