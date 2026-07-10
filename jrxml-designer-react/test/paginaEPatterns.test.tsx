import { MantineProvider } from '@mantine/core';
import { REFERENCIA_ETIQUETA_A4, REFERENCIA_FATURA, serializeJrxml } from '@reportlenz/jrxml-core';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/App';
import { useCanvasStore } from '../src/store/canvasStore';
import { useDocumentoStore, validarDocumento } from '../src/store/documentoStore';
import { atualizarPagina } from '../src/store/mutacoes';

/**
 * Fase 3 — blocos 6 (padrões pt-BR) e 7 (multi-coluna p/ etiquetas A4).
 */

function renderApp() {
  return render(
    <MantineProvider>
      <App />
    </MantineProvider>,
  );
}

describe('jrxml-designer-react · página e multi-coluna (7.1)', () => {
  beforeEach(() => {
    useDocumentoStore.getState().fecharDocumento();
    useCanvasStore.setState({ zoom: 1, mostrarGrid: false, passoGridMm: 5, snapAtivo: false, guiasDeSnap: null });
  });

  it('atualizarPagina: printOrder Vertical some do modelo (default do engine)', () => {
    const comHorizontal = atualizarPagina({ printOrder: 'Horizontal' })(REFERENCIA_FATURA);
    expect(comHorizontal.pageFormat.printOrder).toBe('Horizontal');
    expect(serializeJrxml(comHorizontal)).toContain('printOrder="Horizontal"');

    const deVolta = atualizarPagina({ printOrder: 'Vertical' })(comHorizontal);
    expect(deVolta.pageFormat.printOrder).toBeUndefined();
    expect(validarDocumento(deVolta)).toEqual([]);
  });

  it('aba Página edita colunas: o canvas ganha as guias e o aviso de estouro protege', () => {
    useDocumentoStore.getState().novoDocumento(structuredClone(REFERENCIA_FATURA));
    renderApp();
    fireEvent.click(screen.getByRole('tab', { name: 'Página' }));

    const painel = screen.getByTestId('painel-da-pagina');
    // fatura: 1 coluna de 555 — muda para 3 colunas de 178 com 10 de espaço
    fireEvent.change(within(painel).getByRole('textbox', { name: 'Largura col.' }), { target: { value: '178' } });
    fireEvent.change(within(painel).getByRole('textbox', { name: 'Espaço' }), { target: { value: '10' } });
    fireEvent.change(within(painel).getByRole('textbox', { name: 'Colunas' }), { target: { value: '3' } });

    expect(useDocumentoStore.getState().template?.pageFormat.columnCount).toBe(3);
    expect(screen.getAllByTestId('guia-coluna')).toHaveLength(3);
    expect(screen.queryByTestId('aviso-estouro-colunas')).not.toBeInTheDocument();

    // Estouro: 3 × 300 > 555 úteis
    fireEvent.change(within(painel).getByRole('textbox', { name: 'Largura col.' }), { target: { value: '300' } });
    expect(screen.getByTestId('aviso-estouro-colunas')).toBeInTheDocument();
  });

  it('etiqueta A4 de referência já nasce Horizontal (grade de etiquetas)', () => {
    useDocumentoStore.getState().novoDocumento(structuredClone(REFERENCIA_ETIQUETA_A4));
    renderApp();
    fireEvent.click(screen.getByRole('tab', { name: 'Página' }));
    expect(screen.getByDisplayValue('Horizontal (atravessa a linha)')).toBeInTheDocument();
  });
});

describe('jrxml-designer-react · padrões pt-BR (6.1)', () => {
  beforeEach(() => {
    useDocumentoStore.getState().fecharDocumento();
    useCanvasStore.setState({ zoom: 1, mostrarGrid: false, passoGridMm: 5, snapAtivo: false, guiasDeSnap: null });
    useDocumentoStore.getState().novoDocumento(structuredClone(REFERENCIA_FATURA));
  });

  it('o campo pattern oferece os presets (R$, milhar, dd/MM/yyyy) e commita a escolha', () => {
    renderApp();
    const alvo = screen.getByTestId('el-title/0'); // textField
    fireEvent.pointerDown(alvo, { pointerId: 1 });
    fireEvent.pointerUp(alvo, { pointerId: 1 });

    // Mantine duplica o aria-label no listbox do combobox — fico com o <input>
    const acharCampo = () =>
      screen.getAllByLabelText('Padrão (pattern)').find((el) => el.tagName === 'INPUT') as HTMLElement;
    const campo = acharCampo();
    fireEvent.click(campo);
    fireEvent.change(campo, { target: { value: '¤' } });

    // Preset de moeda aparece e, ao escolher, commita no modelo
    fireEvent.click(screen.getByRole('option', { name: '¤ #,##0.00' }));
    const el = useDocumentoStore.getState().template?.bands.title?.elements[0];
    expect(el?.kind === 'textField' && el.pattern).toBe('¤ #,##0.00');
    expect(useDocumentoStore.getState().problemas).toEqual([]);

    // Data: digitar 'dd' filtra o preset de data
    fireEvent.change(campo, { target: { value: 'dd' } });
    expect(screen.getByRole('option', { name: 'dd/MM/yyyy' })).toBeInTheDocument();
  });
});
