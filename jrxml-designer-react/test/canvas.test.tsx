import { MantineProvider } from '@mantine/core';
import { REFERENCIA_ETIQUETA_A4, REFERENCIA_FATURA } from '@reportlenz/jrxml-core';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/App';
import { useCanvasStore } from '../src/store/canvasStore';
import { useDocumentoStore } from '../src/store/documentoStore';

function renderApp() {
  return render(
    <MantineProvider>
      <App />
    </MantineProvider>,
  );
}

describe('jrxml-designer-react · Canvas (2.1)', () => {
  beforeEach(() => {
    useDocumentoStore.getState().fecharDocumento();
    useCanvasStore.setState({ zoom: 1, mostrarGrid: true, passoGridMm: 5 });
  });

  it('folha A4 em px = pt sob zoom 1; réguas mm presentes', () => {
    useDocumentoStore.getState().novoDocumento(structuredClone(REFERENCIA_FATURA));
    renderApp();

    const pagina = screen.getByTestId('pagina-canvas');
    expect(pagina.style.width).toBe('595px');
    expect(pagina.style.height).toBe('842px');
    expect(screen.getByTestId('regua-horizontal')).toBeInTheDocument();
    expect(screen.getByTestId('regua-vertical')).toBeInTheDocument();
    expect(screen.getByTestId('guia-margens')).toBeInTheDocument();
  });

  it('zoom altera a folha e o indicador', () => {
    useDocumentoStore.getState().novoDocumento(structuredClone(REFERENCIA_FATURA));
    renderApp();

    fireEvent.click(screen.getByRole('button', { name: 'aumentar zoom' }));
    expect(screen.getByTestId('zoom-atual')).toHaveTextContent('125%');
    expect(screen.getByTestId('pagina-canvas').style.width).toBe(`${595 * 1.25}px`);
  });

  it('grid pode ser desligado', () => {
    useDocumentoStore.getState().novoDocumento(structuredClone(REFERENCIA_FATURA));
    renderApp();

    const linhasAntes = screen.getByTestId('pagina-canvas').querySelectorAll('line').length;
    fireEvent.click(screen.getByRole('button', { name: 'Grid' }));
    const linhasDepois = screen.getByTestId('pagina-canvas').querySelectorAll('line').length;
    expect(linhasDepois).toBeLessThan(linhasAntes);
  });

  it('etiqueta A4 mostra as 3 guias de coluna', () => {
    useDocumentoStore.getState().novoDocumento(structuredClone(REFERENCIA_ETIQUETA_A4));
    renderApp();
    expect(screen.getAllByTestId('guia-coluna')).toHaveLength(3);
  });
});
