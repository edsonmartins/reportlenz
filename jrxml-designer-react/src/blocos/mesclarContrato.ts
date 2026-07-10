/**
 * Mescla do mini-contrato de um bloco ao contrato do template
 * (Fase 3, tarefa 8.2).
 *
 * Regras por declaração (field/param/variable):
 * - nome livre → adiciona;
 * - nome ocupado por declaração COMPATÍVEL → reaproveita (não duplica);
 * - nome ocupado por declaração INCOMPATÍVEL → renomeia com sufixo numérico
 *   (`valor` → `valor_2`) e registra o renomeio para reescrever as
 *   expressões do bloco (`$F{valor}` → `$F{valor_2}`).
 */
import type { DataContract, Element, FieldDecl, ParamDecl, VariableDecl } from '@reportlenz/jrxml-core';
import type { MiniContrato } from './biblioteca';

/** Renomeios por espaço de nomes das expressões ($F / $P / $V). */
export interface Renomeios {
  F: Record<string, string>;
  P: Record<string, string>;
  V: Record<string, string>;
}

export interface ResultadoDaMescla {
  contrato: DataContract;
  renomeios: Renomeios;
  /** Mensagens pt-BR sobre reaproveitamentos e renomeios (nada = só adições). */
  avisos: string[];
}

/** Próximo nome livre: `nome_2`, `nome_3`… (não colide com `ocupados`). */
function nomeLivre(nome: string, ocupados: ReadonlySet<string>): string {
  for (let n = 2; ; n++) {
    const candidato = `${nome}_${n}`;
    if (!ocupados.has(candidato)) return candidato;
  }
}

function mesmoField(a: FieldDecl, b: FieldDecl): boolean {
  return a.type === b.type;
}

function mesmoParam(a: ParamDecl, b: ParamDecl): boolean {
  return a.type === b.type;
}

/** Variável só é reaproveitável se calcular a MESMA coisa. */
function mesmaVariavel(a: VariableDecl, b: VariableDecl): boolean {
  return (
    a.type === b.type &&
    a.calculation === b.calculation &&
    (a.expression ?? '') === (b.expression ?? '') &&
    (a.resetType ?? 'Report') === (b.resetType ?? 'Report') &&
    (a.resetGroup ?? '') === (b.resetGroup ?? '')
  );
}

/** Reescreve `$F{a}`/`$P{a}`/`$V{a}` segundo os renomeios (demais intactos). */
export function reescreverExpressao(expressao: string, renomeios: Renomeios): string {
  return expressao.replace(/\$([FPV])\{([^}]*)\}/g, (original, tipo: 'F' | 'P' | 'V', nome: string) => {
    const novo = renomeios[tipo][nome];
    return novo ? `$${tipo}{${novo}}` : original;
  });
}

/** Aplica os renomeios às expressões de um elemento do bloco. */
export function reescreverElemento(elemento: Element, renomeios: Renomeios): Element {
  const el = structuredClone(elemento);
  if ('expression' in el) el.expression = reescreverExpressao(el.expression, renomeios);
  if (el.printWhenExpression) el.printWhenExpression = reescreverExpressao(el.printWhenExpression, renomeios);
  return el;
}

function mesclarLista<T extends { name: string }>(
  existentes: T[],
  novos: T[] | undefined,
  compativeis: (a: T, b: T) => boolean,
  renomear: Record<string, string>,
  avisos: string[],
  rotulo: 'campo' | 'parâmetro' | 'variável',
  transformar: (novo: T) => T = (n) => n,
): T[] {
  if (!novos || novos.length === 0) return existentes;
  const resultado = existentes.slice();
  const ocupados = new Set(resultado.map((d) => d.name));
  for (const bruto of novos) {
    const novo = transformar(bruto);
    const atual = resultado.find((d) => d.name === novo.name);
    if (!atual) {
      resultado.push(novo);
      ocupados.add(novo.name);
      continue;
    }
    if (compativeis(atual, novo)) {
      avisos.push(`${rotulo} "${novo.name}" já existia no contrato e é compatível — reaproveitado.`);
      continue;
    }
    const renomeado = nomeLivre(novo.name, ocupados);
    renomear[novo.name] = renomeado;
    resultado.push({ ...novo, name: renomeado });
    ocupados.add(renomeado);
    avisos.push(`${rotulo} "${novo.name}" conflita com declaração existente — o bloco passa a usar "${renomeado}".`);
  }
  return resultado;
}

export function mesclarMiniContrato(contrato: DataContract, mini: MiniContrato): ResultadoDaMescla {
  const renomeios: Renomeios = { F: {}, P: {}, V: {} };
  const avisos: string[] = [];

  const fields = mesclarLista(contrato.fields, mini.fields, mesmoField, renomeios.F, avisos, 'campo');
  const parameters = mesclarLista(contrato.parameters, mini.parameters, mesmoParam, renomeios.P, avisos, 'parâmetro');
  // Variáveis por último: a expressão delas pode referenciar campos renomeados.
  const variables = mesclarLista(
    contrato.variables,
    mini.variables,
    mesmaVariavel,
    renomeios.V,
    avisos,
    'variável',
    (v) => ({
      ...v,
      expression: v.expression && reescreverExpressao(v.expression, renomeios),
      initialValueExpression: v.initialValueExpression && reescreverExpressao(v.initialValueExpression, renomeios),
    }),
  );

  return { contrato: { fields, parameters, variables }, renomeios, avisos };
}
