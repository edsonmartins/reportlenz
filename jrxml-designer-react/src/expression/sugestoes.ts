/**
 * Motor do expression editor (RFC-004 §5, tarefas phase-3/1.1-1.3) — puro.
 *
 * - Contexto do cursor: dentro de `$F{`/`$P{`/`$V{` → sugestões do CONTRATO
 *   (com escopo: master ou itens de coleção); palavra solta → funções do
 *   catálogo jasperreports-functions.
 * - Validação inline: chaves não fechadas e referências órfãs (a mesma regra
 *   do core, antecipada para feedback enquanto digita).
 */
import type { DataContract } from '@reportlenz/jrxml-core';
import { BUILTIN_PARAMETERS, BUILTIN_VARIABLES } from '@reportlenz/jrxml-core';
import { FUNCOES_JASPER } from './funcoesJasper';

export interface EscopoDeExpressao {
  fields: string[];
  parameters: string[];
  variables: string[];
}

/** Escopo master de um contrato (+ built-ins + variáveis de grupo). */
export function escopoMaster(contrato: DataContract, nomesDeGrupos: string[] = []): EscopoDeExpressao {
  return {
    fields: contrato.fields.map((f) => f.name),
    parameters: [...contrato.parameters.map((p) => p.name), ...BUILTIN_PARAMETERS],
    variables: [
      ...contrato.variables.map((v) => v.name),
      ...BUILTIN_VARIABLES,
      ...nomesDeGrupos.map((g) => `${g}_COUNT`),
    ],
  };
}

// ---------------------------------------------------------------------------
// Contexto do cursor

export type ContextoDoCursor =
  | { tipo: 'ref'; kind: 'F' | 'P' | 'V'; prefixo: string; inicio: number }
  | { tipo: 'funcao'; prefixo: string; inicio: number }
  | null;

/** Analisa o texto até o cursor e decide que tipo de sugestão cabe. */
export function contextoDoCursor(texto: string, cursor: number): ContextoDoCursor {
  const antes = texto.slice(0, cursor);

  // Dentro de uma referência aberta: `... $F{pre` (sem fechar).
  const ref = /\$([FPV])\{([A-Za-z0-9_.]*)$/.exec(antes);
  if (ref) {
    return { tipo: 'ref', kind: ref[1] as 'F' | 'P' | 'V', prefixo: ref[2] ?? '', inicio: cursor - (ref[2]?.length ?? 0) };
  }

  // Palavra solta (função): 2+ letras fora de referência.
  const palavra = /([A-Za-z]{2,})$/.exec(antes);
  if (palavra) {
    return { tipo: 'funcao', prefixo: palavra[1]!, inicio: cursor - palavra[1]!.length };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Sugestões

export interface Sugestao {
  rotulo: string;
  /** Texto que substitui o trecho [inicio, cursor). */
  insercao: string;
  detalhe: string;
}

export function sugestoesPara(contexto: ContextoDoCursor, escopo: EscopoDeExpressao): Sugestao[] {
  if (!contexto) return [];
  const prefixo = contexto.prefixo.toLowerCase();

  if (contexto.tipo === 'ref') {
    const nomes =
      contexto.kind === 'F' ? escopo.fields : contexto.kind === 'P' ? escopo.parameters : escopo.variables;
    return nomes
      .filter((n) => n.toLowerCase().startsWith(prefixo))
      .slice(0, 12)
      .map((n) => ({
        rotulo: n,
        insercao: `${n}}`,
        detalhe: contexto.kind === 'F' ? 'field' : contexto.kind === 'P' ? 'parameter' : 'variable',
      }));
  }

  return FUNCOES_JASPER.filter((f) => f.nome.toLowerCase().startsWith(prefixo))
    .slice(0, 12)
    .map((f) => ({ rotulo: f.assinatura, insercao: `${f.nome}(`, detalhe: f.descricao }));
}

/** Aplica uma sugestão ao texto, devolvendo o novo texto e a posição do cursor. */
export function aplicarSugestao(
  texto: string,
  cursor: number,
  contexto: NonNullable<ContextoDoCursor>,
  sugestao: Sugestao,
): { texto: string; cursor: number } {
  const novo = texto.slice(0, contexto.inicio) + sugestao.insercao + texto.slice(cursor);
  return { texto: novo, cursor: contexto.inicio + sugestao.insercao.length };
}

// ---------------------------------------------------------------------------
// Validação inline (1.2)

export interface ProblemaInline {
  mensagem: string;
}

const REF_COMPLETA = /\$([FPV])\{([^}]*)\}/g;

export function validarExpressaoInline(texto: string, escopo: EscopoDeExpressao): ProblemaInline[] {
  const problemas: ProblemaInline[] = [];

  // Sintaxe: referência aberta sem fechar.
  if (/\$[FPV]\{[^}]*$/.test(texto)) {
    problemas.push({ mensagem: 'referência $…{ sem fechar (falta })' });
  }

  // Nomes: cada referência completa precisa existir no escopo.
  for (const m of texto.matchAll(REF_COMPLETA)) {
    const kind = m[1] as 'F' | 'P' | 'V';
    const nome = m[2] ?? '';
    const conhecidos =
      kind === 'F' ? escopo.fields : kind === 'P' ? escopo.parameters : escopo.variables;
    if (nome === '') {
      problemas.push({ mensagem: `$${kind}{} vazio` });
    } else if (!conhecidos.includes(nome)) {
      const tipo = kind === 'F' ? 'field' : kind === 'P' ? 'parameter' : 'variable';
      problemas.push({ mensagem: `${tipo} "${nome}" não existe no contrato` });
    }
  }

  return problemas;
}
