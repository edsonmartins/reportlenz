/**
 * Contrato de dados (RFC-001 §3, RFC-002, ADR-003) — a materialização do
 * binding Push. `<field>/<parameter>/<variable>` são DECLARAÇÃO de contrato,
 * nunca binding a banco: não existe tipo para query/conexão neste módulo.
 */

/**
 * Tipos de valor do contrato, portáveis entre as três projeções da RFC-002:
 * JSON Schema (`inputSchema`), tipos TS (front) e `record` Java (backend).
 * O parser (tarefa 4.x) mapeia `class` Java ↔ estes tipos
 * (ex.: `java.math.BigDecimal` ↔ `decimal`, `java.time.LocalDate` ↔ `date`).
 */
export type ScalarType =
  | 'string'
  | 'integer'
  | 'decimal'
  | 'boolean'
  | 'date'
  | 'datetime';

/** Tipo de um field: escalar ou coleção (alimenta tabela/detail — vira array no `inputSchema`). */
export type FieldType = ScalarType | 'collection';

/**
 * Declaração de campo esperado no payload (`$F{...}`).
 * Nomes com ponto (`cliente.nome`) viram objeto aninhado no `inputSchema`
 * (heurística de agrupamento da RFC-002 §3).
 */
export interface FieldDecl {
  name: string;
  type: FieldType;
  description?: string;
  /** Obrigatório no payload? Alimenta o `required` do `inputSchema`. */
  required?: boolean;
  /** Campos de cada item — presente somente quando `type === 'collection'`. */
  itemFields?: FieldDecl[];
}

/**
 * Declaração de parâmetro (`$P{...}`): valor de topo fornecido na chamada de
 * render (título, caminho de logo, filtros já resolvidos a montante).
 */
export interface ParamDecl {
  name: string;
  type: ScalarType;
  description?: string;
  required?: boolean;
  /** Expressão de valor default (sintaxe JasperReports). */
  defaultValueExpression?: string;
}

/** Cálculos de variável — enum completo do JRXML 7 (verificado nos samples 7.0.7). */
export type VariableCalculation =
  | 'Nothing'
  | 'Count'
  | 'DistinctCount'
  | 'Sum'
  | 'Average'
  | 'Lowest'
  | 'Highest'
  | 'StandardDeviation'
  | 'Variance'
  | 'System'
  | 'First';

/** Escopo de reinicialização do acumulador da variável. */
export type VariableResetType = 'None' | 'Report' | 'Page' | 'Column' | 'Group';

/**
 * Declaração de variável (`$V{...}`): valor CALCULADO pelo engine durante o
 * fill (sum/count/...). É derivada — **nunca entra no payload** nem no
 * `inputSchema` (RFC-002 §2).
 */
export interface VariableDecl {
  name: string;
  type: ScalarType;
  calculation: VariableCalculation;
  /** Expressão acumulada (ex.: `$F{valor}` para uma soma). */
  expression?: string;
  resetType?: VariableResetType;
  /** Nome do grupo de reset — exigido quando `resetType === 'Group'`. */
  resetGroup?: string;
  initialValueExpression?: string;
}

/** Contrato de dados do template: o que o relatório ESPERA, não de onde vem. */
export interface DataContract {
  fields: FieldDecl[];
  parameters: ParamDecl[];
  /** Calculadas pelo engine — fora do payload. */
  variables: VariableDecl[];
}
