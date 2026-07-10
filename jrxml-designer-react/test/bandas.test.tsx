import { MantineProvider } from '@mantine/core';
import { REFERENCIA_FATURA } from '@reportlenz/jrxml-core';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/App';
import { alturaMinimaDaBanda, faixasDeBandas } from '../src/canvas/bandas';
import { useCanvasStore } from '../src/store/canvasStore';
import { useDocumentoStore } from '../src/store/documentoStore';
import { redimensionarBanda } from '../src/store/mutacoes';

/**
 * Tarefa phase-2/2.2 — bandas empilhadas na ordem de design view, com
 * resize de altura por arraste (clamp no rodapé do elemento mais baixo).
 */
describe('jrxml-designer-react · bandas (2.2)', () => {
  beforeEach(() => {
    useDocumentoStore.getState().fecharDocumento();
    useCanvasStore.setState({ zoom: 1, mostrarGrid: false, passoGridMm: 5 });
  });

  it('faixasDeBandas empilha na ordem de design view com offsets corretos', () => {
    const faixas = faixasDeBandas(REFERENCIA_FATURA);
    const rotulos = faixas.map((f) => f.rotulo);
    expect(rotulos).toEqual([
      'Título',
      'Cabeçalho de página',
      'Cabeçalho de coluna',
      'Grupo por_categoria · cabeçalho',
      'Detalhe',
      'Grupo por_categoria · rodapé',
      'Rodapé de coluna',
      'Rodapé de página',
      'Sumário',
      'Sem dados',
      'Fundo',
    ]);

    // Offsets: começa no topo da área útil (topMargin=30) e acumula alturas.
    expect(faixas[0]?.yPt).toBe(30); // Título (60)
    expect(faixas[1]?.yPt).toBe(90); // Cabeçalho de página (20)
    expect(faixas[2]?.yPt).toBe(110); // Cabeçalho de coluna (16)
    expect(faixas[3]?.yPt).toBe(126); // Grupo header (20)
    expect(faixas[4]?.yPt).toBe(146); // Detalhe (140)
    expect(faixas[5]?.yPt).toBe(286); // Grupo footer
  });

  it('redimensionarBanda muta imutavelmente e respeita a altura mínima', () => {
    const caminho = { tipo: 'secao', secao: 'title' } as const;

    // Título da fatura tem linha em y=55 h=1 → mínimo 56pt.
    expect(alturaMinimaDaBanda(REFERENCIA_FATURA.bands.title!)).toBe(56);

    const maior = redimensionarBanda(caminho, 90)(REFERENCIA_FATURA);
    expect(maior.bands.title?.height).toBe(90);
    expect(REFERENCIA_FATURA.bands.title?.height).toBe(60); // original intacto

    const clampeado = redimensionarBanda(caminho, 10)(REFERENCIA_FATURA);
    expect(clampeado.bands.title?.height).toBe(56);
  });

  it('arrastar o handle redimensiona a banda no canvas (e continua válido)', () => {
    useDocumentoStore.getState().novoDocumento(structuredClone(REFERENCIA_FATURA));
    render(
      <MantineProvider>
        <App />
      </MantineProvider>,
    );

    expect(screen.getByTestId('banda-title')).toBeInTheDocument();
    expect(screen.getByText(/Título · 60pt/)).toBeInTheDocument();

    const handle = screen.getByTestId('resize-title');
    fireEvent.pointerDown(handle, { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientY: 130, pointerId: 1 }); // +30px @ zoom 1 = +30pt
    fireEvent.pointerUp(handle, { pointerId: 1 });

    expect(useDocumentoStore.getState().template?.bands.title?.height).toBe(90);
    expect(screen.getByText(/Título · 90pt/)).toBeInTheDocument();
    expect(useDocumentoStore.getState().problemas).toEqual([]); // validação contínua ok

    // Bandas seguintes deslocam junto (empilhamento reativo).
    expect(screen.getByTestId('banda-pageHeader').style.top).toBe('120px'); // 30+90
  });

  it('arraste abaixo do mínimo clampeia (elemento não vaza da banda)', () => {
    useDocumentoStore.getState().novoDocumento(structuredClone(REFERENCIA_FATURA));
    render(
      <MantineProvider>
        <App />
      </MantineProvider>,
    );

    const handle = screen.getByTestId('resize-title');
    fireEvent.pointerDown(handle, { clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientY: 0, pointerId: 1 }); // tentaria 60-100 = -40pt
    fireEvent.pointerUp(handle, { pointerId: 1 });

    expect(useDocumentoStore.getState().template?.bands.title?.height).toBe(56);
  });
});
