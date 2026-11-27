package dev.reportlenz.render.config;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

/** Registro de templates no banco da aplicação (ADR-026 §3) — `reportlenz.registro.habilitado`, default true. */
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.TYPE, ElementType.METHOD})
@Documented
@ConditionalOnProperty(name = "reportlenz.registro.habilitado", havingValue = "true", matchIfMissing = true)
public @interface RecursoRegistro {}
