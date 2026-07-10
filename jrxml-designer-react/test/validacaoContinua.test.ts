import { REFERENCIA_FATURA } from '@reportlenz/jrxml-core';
import { beforeEach, describe, expect, it } from 'vitest';
import { useDocumentoStore, validarDocumento } from '../src/store/documentoStore';

/**
 * Tarefa phase-2/1.2 — toda mutação passa pelo jrxml-core:
 * serialize → validateSchema (dialeto 7/anti-Pull) + validateContract (G3),
 * alimentando `problemas` (embrião do ReportChecker, bloco 6).
 */
describe('jrxml-designer-react · validação contínua (1.2)', () => {
  beforeEach(() => {
    useDocumentoStore.getState().fecharDocumento();
  });

  it('template de referência abre limpo (0 problemas)', () => {
    useDocumentoStore.getState().novoDocumento(structuredClone(REFERENCIA_FATURA));
    expect(useDocumentoStore.getState().problemas).toEqual([]);
  });

  it('mutação com referência órfã acusa EXPR_UNKNOWN_REF; corrigir limpa', () => {
    useDocumentoStore.getState().novoDocumento(structuredClone(REFERENCIA_FATURA));

    // Quebra: textField do título passa a referenciar parâmetro inexistente.
    useDocumentoStore.getState().mutarTemplate((t) => {
      const proximo = structuredClone(t);
      const el = proximo.bands.title?.elements[0];
      if (el?.kind === 'textField') el.expression = '$P{parametro_fantasma}';
      return proximo;
    });
    const problemas = useDocumentoStore.getState().problemas;
    expect(problemas.some((p) => p.code === 'EXPR_UNKNOWN_REF' && p.message.includes('parametro_fantasma'))).toBe(true);
    expect(problemas[0]?.path).toContain('bands/title');

    // Conserta: volta a referenciar o parâmetro declarado.
    useDocumentoStore.getState().mutarTemplate((t) => {
      const proximo = structuredClone(t);
      const el = proximo.bands.title?.elements[0];
      if (el?.kind === 'textField') el.expression = '$P{titulo}';
      return proximo;
    });
    expect(useDocumentoStore.getState().problemas).toEqual([]);
  });

  it('mutação que remove elementos poda a seleção pendurada', () => {
    useDocumentoStore.getState().novoDocumento(structuredClone(REFERENCIA_FATURA));
    const caminho = { banda: { tipo: 'secao', secao: 'title' } as const, indice: 2 };
    useDocumentoStore.getState().selecionar(caminho);
    expect(useDocumentoStore.getState().selecao).toHaveLength(1);

    // Remove todos os elementos do título → seleção não pode sobreviver.
    useDocumentoStore.getState().mutarTemplate((t) => {
      const proximo = structuredClone(t);
      if (proximo.bands.title) proximo.bands.title.elements = [];
      return proximo;
    });
    expect(useDocumentoStore.getState().selecao).toEqual([]);
  });

  it('validarDocumento nunca lança — erro de serialização vira problema visível', () => {
    const quebrado = structuredClone(REFERENCIA_FATURA);
    // Força um estado impossível (elemento sem kind) que o serializer não conhece.
    // @ts-expect-error — estado deliberadamente inválido para o teste
    quebrado.bands.title.elements.push({ bounds: { x: 0, y: 0, width: 1, height: 1 } });
    const problemas = validarDocumento(quebrado);
    expect(problemas.length).toBeGreaterThan(0);
  });
});
