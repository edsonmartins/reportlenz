/**
 * @reportlenz/jrxml-core — núcleo headless do ReportLenz (RFC-001).
 *
 * Invariantes deste pacote:
 * - I-7: TypeScript puro — sem Vue, React ou APIs de DOM.
 * - ADR-002: dialeto-alvo JRXML 7 (Library 7.0.7); 6.x é rejeitado.
 * - ADR-003: contract-first — `<queryString>` é proibido em qualquer caminho.
 *
 * A API pública (parseJrxml, serializeJrxml, validateSchema, validateContract,
 * extractContract) será exportada aqui conforme as tarefas 3–7 da Fase 0.
 */

/** Versão do dialeto JRXML alvo do parser/serializer (ADR-002). */
export const JRXML_DIALECT_TARGET = '7.0.7' as const;
