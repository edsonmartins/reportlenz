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
import type { Band, Element, ParseError, ReportTemplate } from '@reportlenz/jrxml-core';
import { serializeJrxml, validateContract, validateSchema } from '@reportlenz/jrxml-core';
import { create } from 'zustand';
import type { BlocoReutilizavel } from '../blocos/biblioteca';
import type { Alinhamento } from './mutacoes';
import {
  alinharElementos,
  aplicarZOrder,
  colarElementos,
  distribuirElementos,
  inserirBloco,
  nudgeElementos,
  removerElementos,
} from './mutacoes';

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

export function chaveDeBanda(b: CaminhoDeBanda): string {
  return b.tipo === 'secao' ? b.secao : b.tipo === 'detail' ? `detail[${b.indice}]` : `grupo:${b.nome}:${b.parte}`;
}

export function chaveDoCaminho(c: CaminhoDeElemento): string {
  return `${chaveDeBanda(c.banda)}/${c.indice}`;
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

/** Máximo de estados no histórico de undo (documentos são pequenos). */
const LIMITE_DO_HISTORICO = 100;

export interface DocumentoState {
  template: ReportTemplate | null;
  /** Seleção atual (multi-seleção chega na tarefa 2.5, o tipo já suporta). */
  selecao: CaminhoDeElemento[];
  /** Problemas da validação contínua (preenchido pela tarefa 1.2/6.1). */
  problemas: ParseError[];

  // Undo/redo (2.7): snapshots imutáveis; arrastes coalescem por GESTO.
  passado: ReportTemplate[];
  futuro: ReportTemplate[];
  /** Gesto em andamento (drag): um snapshot só, do início ao fim. */
  gesto: { snapshotInicial: ReportTemplate } | null;

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

  // Teclado e clipboard (2.6). Clipboard é INTERNO, em memória (sem browser storage).
  clipboard: { elementos: Element[]; banda: CaminhoDeBanda; colagens: number } | null;
  moverSelecao: (dxPt: number, dyPt: number) => void;
  removerSelecao: () => void;
  copiarSelecao: () => void;
  colarClipboard: () => void;

  // Undo/redo (2.7).
  iniciarGesto: () => void;
  encerrarGesto: () => void;
  desfazer: () => void;
  refazer: () => void;

  /** Inserção (Fase 3): adiciona na banda da seleção (ou 1ª detail) e seleciona. */
  inserirElemento: (elemento: Element) => void;
  /** Bloco reutilizável (Fase 3, bloco 8): mescla o mini-contrato e cola os elementos. */
  inserirBloco: (bloco: BlocoReutilizavel) => void;
  /** Avisos da última mescla de mini-contrato (phase-4/6.2 — reaproveitamentos/renomeios). */
  avisosDeBloco: string[];
  limparAvisosDeBloco: () => void;
}

export const useDocumentoStore = create<DocumentoState>((set, get) => {
  /**
   * Via ÚNICA de commit de template (2.7): registra histórico (a menos que um
   * gesto esteja aberto — o snapshot foi registrado no início do gesto),
   * revalida e poda a seleção. `selecaoNova` permite comandos que também
   * mudam a seleção (z-order, paste).
   */
  const aplicarTemplate = (proximo: ReportTemplate, selecaoNova?: CaminhoDeElemento[]) => {
    const { template: atual, gesto, passado } = get();
    if (!atual || proximo === atual) return;
    const novoPassado = gesto ? passado : [...passado, atual].slice(-LIMITE_DO_HISTORICO);
    set({
      template: proximo,
      passado: novoPassado,
      futuro: [],
      problemas: validarDocumento(proximo),
      selecao: podarSelecao(proximo, selecaoNova ?? get().selecao),
    });
  };

  return {
  template: null,
  selecao: [],
  problemas: [],
  passado: [],
  futuro: [],
  gesto: null,

  novoDocumento: (template) => {
    set({ template, selecao: [], problemas: validarDocumento(template), passado: [], futuro: [], gesto: null, clipboard: null, avisosDeBloco: [] });
  },

  fecharDocumento: () => {
    set({ template: null, selecao: [], problemas: [], passado: [], futuro: [], gesto: null, clipboard: null, avisosDeBloco: [] });
  },

  mutarTemplate: (mutacao) => {
    const atual = get().template;
    if (!atual) return;
    aplicarTemplate(mutacao(atual));
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
    aplicarTemplate(resultado.template, resultado.selecao);
  },

  clipboard: null,

  moverSelecao: (dxPt, dyPt) => {
    get().mutarTemplate(nudgeElementos(get().selecao, dxPt, dyPt));
  },

  removerSelecao: () => {
    const { selecao } = get();
    if (selecao.length === 0) return;
    get().mutarTemplate(removerElementos(selecao));
    set({ selecao: [] });
  },

  copiarSelecao: () => {
    const { template, selecao } = get();
    if (!template || selecao.length === 0) return;
    const banda = selecao[0]?.banda;
    if (!banda) return;
    // Copia os elementos da primeira banda da seleção (paste previsível na origem).
    const elementos = selecao
      .filter((c) => chaveDeBanda(c.banda) === chaveDeBanda(banda))
      .map((c) => obterBanda(template, c.banda)?.elements[c.indice])
      .filter((el): el is Element => el !== undefined)
      .map((el) => structuredClone(el));
    if (elementos.length > 0) {
      set({ clipboard: { elementos, banda, colagens: 0 } });
    }
  },

  colarClipboard: () => {
    const { template, clipboard } = get();
    if (!template || !clipboard) return;
    const deslocamento = 5 * (clipboard.colagens + 1);
    const resultado = colarElementos(template, clipboard.banda, clipboard.elementos, deslocamento);
    aplicarTemplate(resultado.template, resultado.selecao);
    set({ clipboard: { ...clipboard, colagens: clipboard.colagens + 1 } });
  },

  iniciarGesto: () => {
    const { template, gesto, passado } = get();
    if (!template || gesto) return;
    // O snapshot entra JÁ no início; se o gesto terminar sem mudança, sai.
    set({
      gesto: { snapshotInicial: template },
      passado: [...passado, template].slice(-LIMITE_DO_HISTORICO),
      futuro: [],
    });
  },

  encerrarGesto: () => {
    const { gesto, passado, template } = get();
    if (!gesto) return;
    const semMudanca = template === gesto.snapshotInicial;
    set({
      gesto: null,
      passado: semMudanca && passado[passado.length - 1] === gesto.snapshotInicial ? passado.slice(0, -1) : passado,
    });
  },

  desfazer: () => {
    const { passado, futuro, template } = get();
    const anterior = passado[passado.length - 1];
    if (!template || !anterior) return;
    set({
      template: anterior,
      passado: passado.slice(0, -1),
      futuro: [...futuro, template],
      problemas: validarDocumento(anterior),
      selecao: podarSelecao(anterior, get().selecao),
    });
  },

  refazer: () => {
    const { passado, futuro, template } = get();
    const proximo = futuro[futuro.length - 1];
    if (!template || !proximo) return;
    set({
      template: proximo,
      futuro: futuro.slice(0, -1),
      passado: [...passado, template].slice(-LIMITE_DO_HISTORICO),
      problemas: validarDocumento(proximo),
      selecao: podarSelecao(proximo, get().selecao),
    });
  },

  inserirElemento: (elemento) => {
    const { template, selecao } = get();
    if (!template) return;
    const banda: CaminhoDeBanda = selecao[0]?.banda ?? { tipo: 'detail', indice: 0 };
    const alvo = obterBanda(template, banda);
    if (!alvo) return;
    const resultado = colarElementos(template, banda, [elemento], 0);
    aplicarTemplate(resultado.template, resultado.selecao);
  },

  inserirBloco: (bloco) => {
    const { template } = get();
    if (!template) return;
    const resultado = inserirBloco(template, bloco);
    aplicarTemplate(resultado.template, resultado.selecao);
    // Conflitos/reaproveitamentos da mescla ficam VISÍVEIS (6.2) — nunca silenciosos.
    set({ avisosDeBloco: resultado.avisos });
  },

  avisosDeBloco: [],
  limparAvisosDeBloco: () => {
    set({ avisosDeBloco: [] });
  },
  };
});
