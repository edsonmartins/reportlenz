/**
 * Mapeamento classe Java (atributo `class` do JRXML) ↔ tipos do contrato
 * (RFC-002). Cobre o subconjunto necessário para fatura/comprovante/
 * formulário/etiqueta A4; classes fora da tabela geram `UNSUPPORTED_TYPE`.
 */
import type { FieldType, ScalarType } from '../model/contract.js';

const SCALAR_BY_CLASS: Record<string, ScalarType> = {
  'java.lang.String': 'string',
  'java.lang.Integer': 'integer',
  'java.lang.Long': 'integer',
  'java.lang.Short': 'integer',
  'java.lang.Byte': 'integer',
  'java.math.BigInteger': 'integer',
  'java.lang.Double': 'decimal',
  'java.lang.Float': 'decimal',
  'java.math.BigDecimal': 'decimal',
  'java.lang.Boolean': 'boolean',
  'java.time.LocalDate': 'date',
  'java.sql.Date': 'date',
  'java.time.LocalDateTime': 'datetime',
  'java.time.Instant': 'datetime',
  'java.util.Date': 'datetime',
  'java.sql.Timestamp': 'datetime',
};

/** Classes de coleção que marcam um field como lista (alimenta tabela/detail). */
const COLLECTION_CLASSES = new Set([
  'java.util.Collection',
  'java.util.List',
  'java.util.ArrayList',
]);

export function scalarTypeFromJavaClass(javaClass: string): ScalarType | undefined {
  return SCALAR_BY_CLASS[javaClass];
}

export function fieldTypeFromJavaClass(javaClass: string): FieldType | undefined {
  if (COLLECTION_CLASSES.has(javaClass)) return 'collection';
  return scalarTypeFromJavaClass(javaClass);
}

/** Inverso (serializer, tarefa 5.x): tipo do contrato → classe Java canônica. */
export function javaClassFromScalarType(type: ScalarType): string {
  switch (type) {
    case 'string':
      return 'java.lang.String';
    case 'integer':
      return 'java.lang.Long';
    case 'decimal':
      return 'java.math.BigDecimal';
    case 'boolean':
      return 'java.lang.Boolean';
    case 'date':
      return 'java.time.LocalDate';
    case 'datetime':
      return 'java.time.LocalDateTime';
  }
}
