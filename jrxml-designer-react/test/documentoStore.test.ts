import { REFERENCIA_FATURA } from '@reportlenz/jrxml-core';
import { beforeEach, describe, expect, it } from 'vitest';
import { chaveDoCaminho, obterBanda, useDocumentoStore } from '../src/store/documentoStore';

/**
 * Testes do store do documento (phase-2/1.1): estado puro em memória,
 * mutação imutável, seleção por caminho.
 */
describe('jrxml-designer-react · documentoStore', () => {
  beforeEach(() => {
    useDocumentoStore.getState().fecharDocumento();
  });

  it('novoDocumento carrega um ReportTemplate do core e limpa seleção', () => {
    useDocumentoStore.getState().novoDocumento(structuredClone(REFERENCIA_FATURA));
    const s = useDocumentoStore.getState();
    expect(s.template?.name).toBe('fatura_completa');
    expect(s.selecao).toEqual([]);
    expect(s.problemas).toEqual([]);
  });

  it('mutarTemplate é imutável: a instância anterior não muda', () => {
    useDocumentoStore.getState().novoDocumento(structuredClone(REFERENCIA_FATURA));
    const antes = useDocumentoStore.getState().template;

    useDocumentoStore.getState().mutarTemplate((t) => ({ ...t, name: 'fatura_v2' }));

    const depois = useDocumentoStore.getState().template;
    expect(depois?.name).toBe('fatura_v2');
    expect(antes?.name).toBe('fatura_completa'); // preparada p/ histórico undo/redo (2.7)
    expect(depois).not.toBe(antes);
  });

  it('seleção simples substitui; aditiva alterna (base da multi-seleção 2.5)', () => {
    useDocumentoStore.getState().novoDocumento(structuredClone(REFERENCIA_FATURA));
    const a = { banda: { tipo: 'detail', indice: 0 } as const, indice: 0 };
    const b = { banda: { tipo: 'detail', indice: 0 } as const, indice: 1 };

    useDocumentoStore.getState().selecionar(a);
    expect(useDocumentoStore.getState().selecao).toHaveLength(1);

    useDocumentoStore.getState().selecionar(b, true);
    expect(useDocumentoStore.getState().selecao).toHaveLength(2);

    useDocumentoStore.getState().selecionar(b, true); // alterna: remove
    expect(useDocumentoStore.getState().selecao.map(chaveDoCaminho)).toEqual(['detail[0]/0']);

    useDocumentoStore.getState().selecionar(b); // não aditiva: substitui
    expect(useDocumentoStore.getState().selecao.map(chaveDoCaminho)).toEqual(['detail[0]/1']);
  });

  it('obterBanda resolve seções, detail e grupos', () => {
    const t = structuredClone(REFERENCIA_FATURA);
    expect(obterBanda(t, { tipo: 'secao', secao: 'title' })?.height).toBe(60);
    expect(obterBanda(t, { tipo: 'detail', indice: 0 })?.elements.length).toBeGreaterThan(0);
    expect(obterBanda(t, { tipo: 'grupo', nome: 'por_categoria', parte: 'header' })?.height).toBe(20);
    expect(obterBanda(t, { tipo: 'grupo', nome: 'inexistente', parte: 'header' })).toBeUndefined();
  });
});
