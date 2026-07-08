/**
 * `validateSchema` (tarefa phase-0/6.1, ADR-013): validação ESTRUTURAL do
 * dialeto JRXML 7, em design-time.
 *
 * Não existe XSD oficial da 7.0.7 (ADR-013): as regras estruturais são as do
 * parser (dialeto 7, subconjunto suportado, anti-Pull, tipos do contrato). A
 * autoridade final é o load+compile da Library no harness Java (gate G1);
 * esta validação é a aproximação rápida para o ReportChecker da UI.
 */
import type { ValidationResult } from '../errors.js';
import { parseJrxml } from '../parse/parseJrxml.js';
import { buildLineIndex } from './lineIndex.js';

/** Valida um documento JRXML contra o dialeto 7 (estrutural, TS). */
export function validateSchema(xml: string): ValidationResult {
  const result = parseJrxml(xml);
  if (result.ok) {
    return { valid: true, messages: [] };
  }

  // Enriquecer com linha/coluna do XML de origem (tarefa 6.3).
  const index = buildLineIndex(xml);
  const messages = result.errors.map((e) => {
    if (e.line !== undefined) return e;
    const pos = index.get(e.path);
    return pos ? { ...e, line: pos.line, column: pos.column } : e;
  });

  return { valid: false, messages };
}
