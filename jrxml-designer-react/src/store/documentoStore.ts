/**
 * Store do documento (RFC-004 §2, tarefa phase-2/1.1).
 *
 * O estado do designer é uma instância PURA de `ReportTemplate` (jrxml-core)
 * em memória — sem localStorage/sessionStorage (restrição do CLAUDE.md §6).
 * Toda mutação é imutável (novo template a cada mudança), o que prepara o
 * undo/redo por histórico (tarefa 2.7) e a validação contínua (tarefa 1.2).
 *
 * A seleção referencia elementos por CAMINHO no modelo (banda + índice) —
 * o modelo do core não tem ids de runtime, e caminhos sobrevivem a
 * serialize/parse.
 */
import type { Band, ParseError, ReportTemplate } from '@reportlenz/jrxml-core';
import { serializeJrxml, validateContract, validateSchema } from '@reportlenz/jrxml-core';
import { create } from 'zustand';
import type { Alinhamento } from './mutacoes';
import { alinharElementos, aplicarZOrder, distribuirElementos } from './mutacoes';

// ---------------------------------------------------------------------------
// Caminhos (seleção estável sem ids de runtime)

export type SecaoUnica =
  | 'title'
  | 'background'
  | 'pageHeader'
  | 'columnHeader'
  | 'columnFooter'
  | 'pageFooter'
  | 'summary'
  | 'noData';

export type CaminhoDeBanda =
  | { tipo: 'secao'; secao: SecaoUnica }
  | { tipo: 'detail'; indice: number }
  | { tipo: 'grupo'; nome: string; parte: 'header' | 'footer' };

export interface CaminhoDeElemento {
  banda: CaminhoDeBanda;
  indice: number;
}

export function mesmoCaminho(a: CaminhoDeElemento, b: CaminhoDeElemento): boolean {
  return chaveDoCaminho(a) === chaveDoCaminho(b);
}

export function chaveDoCaminho(c: CaminhoDeElemento): string {
  const b = c.banda;
  const banda =
    b.tipo === 'secao' ? b.secao : b.tipo === 'detail' ? `detail[${b.indice}]` : `grupo:${b.nome}:${b.parte}`;
  return `${banda}/${c.indice}`;
}

/** Resolve o caminho de banda dentro do template (undefined se não existe). */
export function obterBanda(template: ReportTemplate, caminho: CaminhoDeBanda): Band | undefined {
  switch (caminho.tipo) {
    case 'secao':
      return template.bands[caminho.secao];
    case 'detail':
      return template.bands.detail[caminho.indice];
    case 'grupo': {
      const grupo = template.bands.groups.find((g) => g.name === caminho.nome);
      return caminho.parte === 'header' ? grupo?.header : grupo?.footer;
    }
  }
}

// ---------------------------------------------------------------------------
// Validação contínua (RFC-004 §2, tarefa phase-2/1.2)

/**
 * Toda mutação passa pelo jrxml-core: round-trip estrutural
 * (serialize → validateSchema, dialeto 7/anti-Pull) + integridade de
 * contrato (validateContract, G3). O resultado alimenta o ReportChecker
 * (bloco 6). Erro inesperado do serializer vira problema visível — nunca
 * exceção engolida.
 */
export function validarDocumento(template: ReportTemplate): ParseError[] {
  try {
    const xml = serializeJrxml(template);
    return [...validateSchema(xml).messages, ...validateContract(template).messages];
  } catch (e) {
    return [
      {
        code: 'XML_MALFORMED',
        message: `falha ao serializar o documento: ${e instanceof Error ? e.message : String(e)}`,
        path: '',
      },
    ];
  }
}

/** Remove seleções que a mutação tornou inválidas (elemento/banda removidos). */
function podarSelecao(template: ReportTemplate, selecao: CaminhoDeElemento[]): CaminhoDeElemento[] {
  return selecao.filter((caminho) => {
    const banda = obterBanda(template, caminho.banda);
    return banda !== undefined && caminho.indice >= 0 && caminho.indice < banda.elements.length;
  });
}

// ---------------------------------------------------------------------------
// Store

export interface DocumentoState {
  template: ReportTemplate | null;
  /** Seleção atual (multi-seleção chega na tarefa 2.5, o tipo já suporta). */
  selecao: CaminhoDeElemento[];
  /** Problemas da validação contínua (preenchido pela tarefa 1.2/6.1). */
  problemas: ParseError[];

  novoDocumento: (template: ReportTemplate) => void;
  fecharDocumento: () => void;
  /** Mutação imutável do template; a validação contínua entra na tarefa 1.2. */
  mutarTemplate: (mutacao: (t: ReportTemplate) => ReportTemplate) => void;
  selecionar: (caminho: CaminhoDeElemento, aditivo?: boolean) => void;
  limparSelecao: () => void;

  // Comandos de multi-seleção (2.5) — exigem seleção numa mesma banda.
  alinharSelecao: (alinhamento: Alinhamento) => void;
  distribuirSelecao: (eixo: 'horizontal' | 'vertical') => void;
  zOrderSelecao: (direcao: 'frente' | 'tras') => void;
}

export const useDocumentoStore = create<DocumentoState>((set, get) => ({
  template: null,
  selecao: [],
  problemas: [],

  novoDocumento: (template) => {
    set({ template, selecao: [], problemas: validarDocumento(template) });
  },

  fecharDocumento: () => {
    set({ template: null, selecao: [], problemas: [] });
  },

  mutarTemplate: (mutacao) => {
    const atual = get().template;
    if (!atual) return;
    const proximo = mutacao(atual);
    set({
      template: proximo,
      problemas: validarDocumento(proximo),
      selecao: podarSelecao(proximo, get().selecao),
    });
  },

  selecionar: (caminho, aditivo = false) => {
    const { selecao } = get();
    if (!aditivo) {
      set({ selecao: [caminho] });
      return;
    }
    const jaSelecionado = selecao.some((c) => mesmoCaminho(c, caminho));
    set({
      selecao: jaSelecionado ? selecao.filter((c) => !mesmoCaminho(c, caminho)) : [...selecao, caminho],
    });
  },

  limparSelecao: () => {
    set({ selecao: [] });
  },

  alinharSelecao: (alinhamento) => {
    get().mutarTemplate(alinharElementos(get().selecao, alinhamento));
  },

  distribuirSelecao: (eixo) => {
    get().mutarTemplate(distribuirElementos(get().selecao, eixo));
  },

  zOrderSelecao: (direcao) => {
    const { template, selecao } = get();
    if (!template) return;
    const resultado = aplicarZOrder(template, selecao, direcao);
    set({
      template: resultado.template,
      problemas: validarDocumento(resultado.template),
      selecao: resultado.selecao,
    });
  },
}));
