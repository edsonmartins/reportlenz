import { MantineProvider } from '@mantine/core';
import { REFERENCIA_FATURA } from '@reportlenz/jrxml-core';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/App';
import { caminhoDoProblema } from '../src/checker/caminhos';
import { useCanvasStore } from '../src/store/canvasStore';
import { useDocumentoStore } from '../src/store/documentoStore';

/**
 * Bloco 6 — ReportChecker: painel de problemas com as mensagens do core;
 * clicar num problema de elemento seleciona o elemento no canvas.
 */

function renderApp() {
  return render(
    <MantineProvider>
      <App />
    </MantineProvider>,
  );
}

describe('jrxml-designer-react · caminhoDoProblema (6.1, puro)', () => {
  it('converte paths de modelo em caminhos de seleção', () => {
    expect(caminhoDoProblema(REFERENCIA_FATURA, 'bands/title/elements[2]')).toEqual({
      banda: { tipo: 'secao', secao: 'title' },
      indice: 2,
    });
    expect(caminhoDoProblema(REFERENCIA_FATURA, 'bands/detail[0]/elements[1]/columns[0]/detail/elements[0]')).toEqual({
      banda: { tipo: 'detail', indice: 0 },
      indice: 1, // célula de tabela navega até o elemento tabela
    });
    expect(caminhoDoProblema(REFERENCIA_FATURA, 'bands/groups[0]/header/elements[0]')).toEqual({
      banda: { tipo: 'grupo', nome: 'por_categoria', parte: 'header' },
      indice: 0,
    });
    // Problemas sem elemento não navegam.
    expect(caminhoDoProblema(REFERENCIA_FATURA, 'dataContract/variables[0]')).toBeNull();
    expect(caminhoDoProblema(REFERENCIA_FATURA, 'styles[1]/conditionalStyles[0]')).toBeNull();
  });
});

describe('jrxml-designer-react · ReportChecker (6.1)', () => {
  beforeEach(() => {
    useDocumentoStore.getState().fecharDocumento();
    useCanvasStore.setState({ zoom: 1, mostrarGrid: false, passoGridMm: 5, snapAtivo: false, guiasDeSnap: null });
    useDocumentoStore.getState().novoDocumento(structuredClone(REFERENCIA_FATURA));
  });

  it('template válido: painel presente com zero problemas', () => {
    renderApp();
    expect(screen.getByTestId('report-checker')).toBeInTheDocument();
    expect(screen.getByTestId('checker-vazio')).toBeInTheDocument();
  });

  it('problema de expressão lista código+mensagem+caminho; clique seleciona o elemento', () => {
    renderApp();

    act(() => {
      useDocumentoStore.getState().mutarTemplate((t) => {
        const p = structuredClone(t);
        const el = p.bands.title?.elements[0];
        if (el?.kind === 'textField') el.expression = '$F{fantasma}';
        return p;
      });
    });

    const linha = screen.getByTestId('problema-0');
    expect(linha).toHaveTextContent('EXPR_UNKNOWN_REF');
    expect(linha).toHaveTextContent('fantasma');
    expect(linha).toHaveTextContent('bands/title/elements[0]');

    fireEvent.click(screen.getByRole('button', { name: /ir para o problema/ }));
    expect(screen.getByTestId('el-title/0')).toHaveAttribute('data-selecionado');
  });

  it('problema sem elemento (resetGroup fantasma) aparece mas não navega', () => {
    renderApp();

    act(() => {
      useDocumentoStore.getState().mutarTemplate((t) => {
        const p = structuredClone(t);
        p.dataContract.variables[1]!.resetGroup = 'grupo_fantasma';
        return p;
      });
    });

    const linha = screen.getByTestId('problema-0');
    expect(linha).toHaveTextContent('grupo_fantasma');
    expect(screen.queryByRole('button', { name: /ir para o problema/ })).not.toBeInTheDocument();
  });

  it('recolher/expandir o painel', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'alternar painel de problemas' }));
    expect(screen.queryByTestId('checker-vazio')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'alternar painel de problemas' }));
    expect(screen.getByTestId('checker-vazio')).toBeInTheDocument();
  });
});
