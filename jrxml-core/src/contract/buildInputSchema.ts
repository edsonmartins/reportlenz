/**
 * `buildInputSchema` (RFC-002 §2-§3, tarefas phase-1/3.1 e 3.2): projeta um
 * `DataContract` como JSON Schema draft 2020-12 — o contrato executável que o
 * serviço de render valida ANTES de preencher (422 se o payload não satisfaz).
 *
 * Heurística de agrupamento (§3):
 * - nomes pontuados com prefixo comum (`cliente.nome`, `cliente.documento`)
 *   viram objeto aninhado `cliente`;
 * - campo-coleção vira `array` de objeto (itemFields, recursivo);
 * - `parameter` vira propriedade de topo;
 * - `variable` é calculada pelo engine e NUNCA entra no payload (§2).
 *
 * `required`: folha exigida entra no `required` do seu objeto; um objeto de
 * agrupamento é exigido quando QUALQUER descendente é exigido (como no
 * exemplo canônico do §2, onde `cliente` é required e `cliente.endereco` não).
 */
import type { DataContract, FieldDecl, ParamDecl, ScalarType } from '../model/contract.js';

/** Subconjunto de JSON Schema 2020-12 emitido pelo ReportLenz. */
export interface JsonSchema {
  $schema?: string;
  $id?: string;
  type: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean';
  format?: string;
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
}

export interface BuildInputSchemaOptions {
  /** Compõe o `$id` canônico `reportlenz:contract:{templateName}:v{version}`. */
  templateName?: string;
  version?: number;
}

const SCHEMA_2020_12 = 'https://json-schema.org/draft/2020-12/schema';

// ---------------------------------------------------------------------------
// Árvore de agrupamento por prefixo pontuado

type Declaracao = FieldDecl | ParamDecl;

interface No {
  /** Presente quando o nó é folha (declaração real do contrato). */
  decl?: Declaracao;
  /** Filhos de um nó de agrupamento, em ordem de declaração. */
  filhos: Map<string, No>;
}

function inserir(raiz: No, decl: Declaracao): void {
  const partes = decl.name.split('.');
  let atual = raiz;
  for (const [i, parte] of partes.entries()) {
    const ultima = i === partes.length - 1;
    let filho = atual.filhos.get(parte);
    if (!filho) {
      filho = { filhos: new Map() };
      atual.filhos.set(parte, filho);
    }
    if (ultima) {
      if (filho.decl !== undefined || filho.filhos.size > 0) {
        throw new Error(
          `conflito de agrupamento no contrato: "${decl.name}" colide com declarações aninhadas sob o mesmo prefixo`,
        );
      }
      filho.decl = decl;
    } else if (filho.decl !== undefined) {
      throw new Error(
        `conflito de agrupamento no contrato: "${partes.slice(0, i + 1).join('.')}" é escalar e também prefixo de "${decl.name}"`,
      );
    }
    atual = filho;
  }
}

// ---------------------------------------------------------------------------
// Projeção árvore → JSON Schema

function schemaDeEscalar(type: ScalarType, description?: string): JsonSchema {
  const base: JsonSchema =
    type === 'decimal'
      ? { type: 'number' }
      : type === 'date'
        ? { type: 'string', format: 'date' }
        : type === 'datetime'
          ? { type: 'string', format: 'date-time' }
          : { type };
  return description !== undefined ? { ...base, description } : base;
}

function schemaDeColecao(decl: FieldDecl): JsonSchema {
  const raizItens: No = { filhos: new Map() };
  for (const item of decl.itemFields ?? []) {
    inserir(raizItens, item);
  }
  const itens = schemaDeObjeto(raizItens);
  return {
    type: 'array',
    ...(decl.description !== undefined ? { description: decl.description } : {}),
    items: itens,
  };
}

function schemaDeNo(no: No): JsonSchema {
  if (no.decl !== undefined) {
    const decl = no.decl;
    if (decl.type === 'collection') {
      return schemaDeColecao(decl);
    }
    return schemaDeEscalar(decl.type, decl.description);
  }
  return schemaDeObjeto(no);
}

function schemaDeObjeto(no: No): JsonSchema {
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];
  for (const [nome, filho] of no.filhos) {
    properties[nome] = schemaDeNo(filho);
    if (temObrigatorio(filho)) {
      required.push(nome);
    }
  }
  return {
    type: 'object',
    ...(required.length > 0 ? { required } : {}),
    properties,
  };
}

/** Um nó é exigido quando sua folha é `required` ou qualquer descendente é. */
function temObrigatorio(no: No): boolean {
  if (no.decl !== undefined) {
    return no.decl.required === true;
  }
  for (const filho of no.filhos.values()) {
    if (temObrigatorio(filho)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------

/**
 * Gera o `inputSchema` (JSON Schema 2020-12) do payload a partir do contrato.
 * Variables ficam de fora por construção — a função nem as lê.
 */
export function buildInputSchema(contract: DataContract, options?: BuildInputSchemaOptions): JsonSchema {
  const raiz: No = { filhos: new Map() };
  // Parâmetros primeiro (valores de topo: título, logo), depois os campos —
  // ambos são propriedades do MESMO payload (RFC-002 §2).
  for (const p of contract.parameters) {
    inserir(raiz, p);
  }
  for (const f of contract.fields) {
    inserir(raiz, f);
  }

  const corpo = schemaDeObjeto(raiz);
  return {
    $schema: SCHEMA_2020_12,
    ...(options?.templateName !== undefined
      ? { $id: `reportlenz:contract:${options.templateName}:v${options.version ?? 1}` }
      : {}),
    ...corpo,
  };
}
