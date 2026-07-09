/**
 * `genTypeScriptTypes` (RFC-002 §4, tarefa phase-1/3.3): projeta o
 * `inputSchema` como interfaces TypeScript — alimenta o autocomplete do
 * expression editor e o front que monta payloads de exemplo.
 *
 * Convenções: objeto aninhado vira interface nomeada pelo caminho em
 * PascalCase (`cliente` → `Cliente`); item de array ganha sufixo `Item`
 * (`itens` → `ItensItem`). Propriedade fora do `required` sai opcional (`?`).
 */
import type { JsonSchema } from './buildInputSchema.js';

export interface GenTypeScriptOptions {
  /** Nome da interface raiz (default: `Payload`). */
  rootName?: string;
}

function pascal(nome: string): string {
  const limpo = nome.replace(/[^A-Za-z0-9_$]/g, '_');
  return limpo.charAt(0).toUpperCase() + limpo.slice(1);
}

function tipoTs(schema: JsonSchema, caminho: string[], interfaces: string[]): string {
  switch (schema.type) {
    case 'string':
      return 'string';
    case 'number':
    case 'integer':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'array': {
      const nomeItem = caminho.map(pascal).join('') + 'Item';
      const itens = schema.items ?? { type: 'object' as const, properties: {} };
      if (itens.type === 'object') {
        emitirInterface(nomeItem, itens, caminho, interfaces);
        return `${nomeItem}[]`;
      }
      return `${tipoTs(itens, caminho, interfaces)}[]`;
    }
    case 'object': {
      const nome = caminho.map(pascal).join('');
      emitirInterface(nome, schema, caminho, interfaces);
      return nome;
    }
  }
}

function emitirInterface(nome: string, schema: JsonSchema, caminho: string[], interfaces: string[]): void {
  const required = new Set(schema.required ?? []);
  const linhas: string[] = [];
  for (const [prop, sub] of Object.entries(schema.properties ?? {})) {
    if (sub.description !== undefined) {
      linhas.push(`  /** ${sub.description} */`);
    }
    const doc = sub.format !== undefined ? ` // formato: ${sub.format}` : '';
    const opcional = required.has(prop) ? '' : '?';
    linhas.push(`  ${prop}${opcional}: ${tipoTs(sub, [...caminho, prop], interfaces)};${doc}`);
  }
  interfaces.push(`export interface ${nome} {\n${linhas.join('\n')}\n}`);
}

/** Gera o arquivo `.ts` (interfaces exportadas) a partir do `inputSchema`. */
export function genTypeScriptTypes(schema: JsonSchema, options?: GenTypeScriptOptions): string {
  const rootName = options?.rootName ?? 'Payload';
  const interfaces: string[] = [];
  emitirInterface(rootName, schema, [], interfaces);

  const cabecalho =
    `// Gerado por @reportlenz/jrxml-core a partir do inputSchema` +
    (schema.$id !== undefined ? ` (${schema.$id})` : '') +
    ` — NÃO editar manualmente.\n`;
  // A raiz é emitida por último pelo caminhamento; inverte p/ ela abrir o arquivo.
  return cabecalho + '\n' + interfaces.reverse().join('\n\n') + '\n';
}
