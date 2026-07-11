import { MantineProvider } from '@mantine/core';
import { PROPRIEDADE_DATASOURCE, REFERENCIA_ETIQUETA_A4, REFERENCIA_FATURA } from '@reportlenz/jrxml-core';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/App';
import { gerarDadosDeExemplo } from '../src/preview/dadosDeExemplo';
import { definirFonteDeLinhas } from '../src/store/mutacoes';
import { useCanvasStore } from '../src/store/canvasStore';
import { useDocumentoStore } from '../src/store/documentoStore';

/**
 * Grade multi-registro na UI (ADR-015, change grade-multiregistro-push,
 * tarefas 3.1-3.3): select "Fonte de linhas" na aba Página, dados de exemplo
 * com 9 itens para a grade e a etiqueta de referência migrada.
 */

describe('jrxml-designer-react · fonte de linhas (grade, 3.1-3.3)', () => {
  beforeEach(() => {
    useDocumentoStore.getState().fecharDocumento();
    useCanvasStore.setState({ zoom: 1, mostrarGrid: false, passoGridMm: 5, snapAtivo: false, guiasDeSnap: null });
  });

  it('3.3: a etiqueta de referência usa a grade e continua válida nos gates', () => {
    useDocumentoStore.getState().novoDocumento(structuredClone(REFERENCIA_ETIQUETA_A4));
    expect(REFERENCIA_ETIQUETA_A4.properties[PROPRIEDADE_DATASOURCE]).toBe('etiquetas');
    expect(useDocumentoStore.getState().problemas).toEqual([]);
  });

  it('3.1: o select mostra a fonte atual e trocar para registro único remove a property', () => {
    useDocumentoStore.getState().novoDocumento(structuredClone(REFERENCIA_ETIQUETA_A4));
    render(
      <MantineProvider>
        <App />
      </MantineProvider>,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Página' }));
    expect(screen.getByDisplayValue('Coleção "etiquetas" (1 item = 1 linha)')).toBeInTheDocument();

    // Trocar para registro único: property sai e o escopo antigo passa a valer
    // (as bandas referenciam itens → ReportChecker acusa — mudança CONSCIENTE).
    useDocumentoStore.getState().mutarTemplate(definirFonteDeLinhas(undefined));
    expect(useDocumentoStore.getState().template?.properties[PROPRIEDADE_DATASOURCE]).toBeUndefined();
    expect(useDocumentoStore.getState().problemas.some((p) => p.code === 'EXPR_UNKNOWN_REF')).toBe(true);

    // Voltar para a coleção: tudo verde de novo (undo-ável por ser mutação comum).
    useDocumentoStore.getState().mutarTemplate(definirFonteDeLinhas('etiquetas'));
    expect(useDocumentoStore.getState().problemas).toEqual([]);
  });

  it('3.1: na fatura (sem grade) o select oferece as coleções do contrato', () => {
    useDocumentoStore.getState().novoDocumento(structuredClone(REFERENCIA_FATURA));
    render(
      <MantineProvider>
        <App />
      </MantineProvider>,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Página' }));
    expect(screen.getByDisplayValue('Registro único (padrão)')).toBeInTheDocument();
  });

  it('3.2: dados de exemplo geram 9 itens para a coleção-datasource (grade real no preview)', () => {
    const semGrade = gerarDadosDeExemplo(REFERENCIA_ETIQUETA_A4.dataContract);
    expect((semGrade.etiquetas as unknown[]).length).toBe(2);

    const comGrade = gerarDadosDeExemplo(REFERENCIA_ETIQUETA_A4.dataContract, { datasourceCampo: 'etiquetas' });
    const itens = comGrade.etiquetas as Array<Record<string, unknown>>;
    expect(itens).toHaveLength(9);
    expect(itens[0]).toHaveProperty('produto_nome');
    expect(itens[8]).toHaveProperty('preco');
  });
});
