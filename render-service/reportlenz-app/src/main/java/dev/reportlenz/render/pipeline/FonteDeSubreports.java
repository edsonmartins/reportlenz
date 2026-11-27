package dev.reportlenz.render.pipeline;

import java.util.Optional;

/**
 * De onde vêm os templates referenciados por subreport (ADR-020): sem versão →
 * a `published` atual; com versão → aquela versão se `published`/`deprecated`.
 */
@FunctionalInterface
public interface FonteDeSubreports {

    Optional<String> jrxml(ReferenciaDeSubreport referencia);
}
