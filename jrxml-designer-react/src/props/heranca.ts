/**
 * Resolução de herança de estilo (RFC-004 §4, tarefa phase-2/3.2 — padrão
 * Jaspersoft Studio): de onde vem o valor efetivo de cada propriedade visual?
 *
 * Cadeia: sobrescrita LOCAL do elemento → estilo nomeado do styleRef (subindo
 * por parentStyleRef, com proteção a ciclos) → estilo default do relatório →
 * default do engine. Tudo que não é 'local' aparece em cinza-claro no painel.
 */
import type { Element, ReportTemplate, Style, StyleProps } from '@reportlenz/jrxml-core';

export type OrigemDoValor = 'local' | 'estiloNomeado' | 'estiloDefault' | 'engine';

export interface ValorComOrigem<V> {
  valor: V | undefined;
  origem: OrigemDoValor;
  /** Nome do estilo que forneceu o valor (quando origem = estiloNomeado). */
  estilo?: string;
}

function estiloPorNome(template: ReportTemplate, nome: string): Style | undefined {
  return template.styles.find((s) => s.name === nome);
}

export function resolverPropDeEstilo<K extends keyof StyleProps>(
  template: ReportTemplate,
  elemento: Element,
  prop: K,
): ValorComOrigem<StyleProps[K]> {
  const local = elemento.style?.[prop];
  if (local !== undefined) {
    return { valor: local, origem: 'local' };
  }

  // Cadeia do styleRef (com proteção contra ciclo de parentStyleRef).
  const visitados = new Set<string>();
  let atual = elemento.styleRef ? estiloPorNome(template, elemento.styleRef) : undefined;
  while (atual && !visitados.has(atual.name)) {
    visitados.add(atual.name);
    const valor = atual[prop];
    if (valor !== undefined) {
      return { valor, origem: 'estiloNomeado', estilo: atual.name };
    }
    atual = atual.parentStyleRef ? estiloPorNome(template, atual.parentStyleRef) : undefined;
  }

  const padrao = template.styles.find((s) => s.isDefault);
  const doPadrao = padrao?.[prop];
  if (padrao && doPadrao !== undefined) {
    return { valor: doPadrao, origem: 'estiloDefault', estilo: padrao.name };
  }

  return { valor: undefined, origem: 'engine' };
}
