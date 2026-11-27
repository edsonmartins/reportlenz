package dev.reportlenz.render.config;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

/** Assistente de IA — OpenRouter (ADR-026 §3) — `reportlenz.assistente.habilitado`, default true. */
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.TYPE, ElementType.METHOD})
@Documented
@ConditionalOnProperty(name = "reportlenz.assistente.habilitado", havingValue = "true", matchIfMissing = true)
public @interface RecursoAssistente {}
