/**
 * Erros estruturados do jrxml-core (RFC-001 §4 e §6).
 * As mensagens carregam localização por caminho de elemento (`path`) para
 * alimentar o ReportChecker da UI; linha/coluna são adicionadas quando o
 * subsistema tiver acesso a offsets (a validação estrutural da tarefa 6.x).
 */

/** Códigos de erro do parse e da validação (RFC-001 §6). */
export type ErrorCode =
  /** XML mal-formado (não é sequer XML válido). */
  | 'XML_MALFORMED'
  /** Documento usa construções do dialeto 6.x (ADR-002). */
  | 'LEGACY_DIALECT'
  /** Documento embute query/conexão — Pull proibido (ADR-003, I-3). */
  | 'CONTRACT_PULL_FORBIDDEN'
  /** Expressão referencia field/param/variable inexistente no contrato. */
  | 'EXPR_UNKNOWN_REF'
  /** Elemento/kind fora do subconjunto suportado (RFC-001 §7). */
  | 'UNSUPPORTED_ELEMENT'
  /** Classe Java sem mapeamento para os tipos do contrato. */
  | 'UNSUPPORTED_TYPE'
  /** Atributo obrigatório ausente ou com valor inválido. */
  | 'INVALID_ATTRIBUTE';

/** Erro estruturado com localização por caminho (ex.: `detail/band[0]/element[2]`). */
export interface ParseError {
  code: ErrorCode;
  message: string;
  /** Caminho do elemento no documento, para o ReportChecker apontar o local. */
  path: string;
  /** Linha no XML de origem (1-based), quando determinável. */
  line?: number;
  /** Coluna no XML de origem (1-based), quando determinável. */
  column?: number;
}

/** Resultado de operações que podem falhar com erros estruturados. */
export type Result<T, E> = { ok: true; value: T } | { ok: false; errors: E };

/** Resultado de validação (RFC-001 §4/§6): mensagens estruturadas p/ o ReportChecker. */
export interface ValidationResult {
  valid: boolean;
  messages: ParseError[];
}
