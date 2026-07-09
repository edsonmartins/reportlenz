/**
 * `genJavaRecord` (RFC-002 §4, tarefa phase-1/3.3): projeta o `inputSchema`
 * como `record` Java — o formato que o backend de domínio usa para montar o
 * payload/datasource no formato exato do contrato (RFC-003).
 *
 * Emite UM arquivo: o record raiz público com os records aninhados dentro
 * (compilável isoladamente). Mapeamento de tipos: string→String,
 * integer→Long, number→BigDecimal, boolean→Boolean, date→LocalDate,
 * date-time→LocalDateTime, array→List<Item>.
 */
import type { JsonSchema } from './buildInputSchema.js';

export interface GenJavaRecordOptions {
  /** Nome do record raiz (default: `Payload`). */
  rootName?: string;
  /** Package do arquivo gerado (default: sem package). */
  packageName?: string;
}

function pascal(nome: string): string {
  const limpo = nome.replace(/[^A-Za-z0-9_$]/g, '_');
  return limpo.charAt(0).toUpperCase() + limpo.slice(1);
}

function identificador(nome: string): string {
  return nome.replace(/[^A-Za-z0-9_$]/g, '_');
}

function tipoJava(schema: JsonSchema, caminho: string[], aninhados: string[]): string {
  switch (schema.type) {
    case 'string':
      return schema.format === 'date'
        ? 'java.time.LocalDate'
        : schema.format === 'date-time'
          ? 'java.time.LocalDateTime'
          : 'String';
    case 'integer':
      return 'Long';
    case 'number':
      return 'java.math.BigDecimal';
    case 'boolean':
      return 'Boolean';
    case 'array': {
      const nomeItem = caminho.map(pascal).join('') + 'Item';
      const itens = schema.items ?? { type: 'object' as const, properties: {} };
      if (itens.type === 'object') {
        emitirRecord(nomeItem, itens, caminho, aninhados, false);
        return `java.util.List<${nomeItem}>`;
      }
      return `java.util.List<${tipoJava(itens, caminho, aninhados)}>`;
    }
    case 'object': {
      const nome = caminho.map(pascal).join('');
      emitirRecord(nome, schema, caminho, aninhados, false);
      return nome;
    }
  }
}

function componentes(schema: JsonSchema, caminho: string[], aninhados: string[]): string {
  const partes: string[] = [];
  for (const [prop, sub] of Object.entries(schema.properties ?? {})) {
    partes.push(`${tipoJava(sub, [...caminho, prop], aninhados)} ${identificador(prop)}`);
  }
  return partes.join(', ');
}

function emitirRecord(
  nome: string,
  schema: JsonSchema,
  caminho: string[],
  aninhados: string[],
  raiz: boolean,
): string {
  const corpo = componentes(schema, caminho, aninhados);
  if (raiz) {
    return corpo; // componentes da raiz; records aninhados já coletados
  }
  aninhados.push(`    public record ${nome}(${corpo}) {}`);
  return nome;
}

/** Gera o arquivo `.java` (record raiz + aninhados) a partir do `inputSchema`. */
export function genJavaRecord(schema: JsonSchema, options?: GenJavaRecordOptions): string {
  const rootName = options?.rootName ?? 'Payload';
  const aninhados: string[] = [];
  const corpoRaiz = emitirRecord(rootName, schema, [], aninhados, true);

  const linhas: string[] = [];
  if (options?.packageName !== undefined) {
    linhas.push(`package ${options.packageName};`, '');
  }
  linhas.push(
    `// Gerado por @reportlenz/jrxml-core a partir do inputSchema` +
      (schema.$id !== undefined ? ` (${schema.$id})` : '') +
      ` — NÃO editar manualmente.`,
    `public record ${rootName}(${corpoRaiz}) {`,
    ...aninhados,
    `}`,
  );
  return linhas.join('\n') + '\n';
}
