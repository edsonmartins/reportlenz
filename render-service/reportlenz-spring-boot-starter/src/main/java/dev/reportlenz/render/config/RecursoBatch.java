package dev.reportlenz.render.config;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

/** Batch assíncrono — Redis Streams + storage (ADR-026 §3) — `reportlenz.batch.habilitado`, default true. */
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.TYPE, ElementType.METHOD})
@Documented
@ConditionalOnProperty(name = "reportlenz.batch.habilitado", havingValue = "true", matchIfMissing = true)
public @interface RecursoBatch {}
