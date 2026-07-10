import { MantineProvider } from '@mantine/core';
import { REFERENCIA_FATURA } from '@reportlenz/jrxml-core';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/App';
import { useCanvasStore } from '../src/store/canvasStore';
import { useDocumentoStore } from '../src/store/documentoStore';
import { atualizarBoundsDoElemento } from '../src/store/mutacoes';

/**
 * Tarefa phase-2/2.3 — elementos selecionáveis, movíveis e redimensionáveis,
 * sempre clampeados dentro da banda (o engine recusa elemento vazando).
 */

const TITULO_0 = { banda: { tipo: 'secao', secao: 'title' } as const, indice: 0 }; // textField 0,0 300×30
const TITULO_1 = { banda: { tipo: 'secao', secao: 'title' } as const, indice: 1 }; // image 455,0 100×50

function renderApp() {
  return render(
    <MantineProvider>
      <App />
    </MantineProvider>,
  );
}

describe('jrxml-designer-react · elementos (2.3)', () => {
  beforeEach(() => {
    useDocumentoStore.getState().fecharDocumento();
    useCanvasStore.setState({ zoom: 1, mostrarGrid: false, passoGridMm: 5 });
    useDocumentoStore.getState().novoDocumento(structuredClone(REFERENCIA_FATURA));
  });

  it('atualizarBoundsDoElemento clampeia dentro da banda (mutação pura)', () => {
    const t = useDocumentoStore.getState().template!;

    // Mover a imagem (455,0 100×50) para além da borda direita → x = 555-100.
    const m1 = atualizarBoundsDoElemento(TITULO_1, { x: 700, y: 0, width: 100, height: 50 })(t);
    expect(m1.bands.title?.elements[1]?.bounds.x).toBe(455);

    // Altura maior que a banda (60) → clampeia; tamanho mínimo 1pt.
    const m2 = atualizarBoundsDoElemento(TITULO_0, { x: 0, y: 0, width: 0, height: 500 })(t);
    expect(m2.bands.title?.elements[0]?.bounds).toEqual({ x: 0, y: 0, width: 1, height: 60 });
  });

  it('clique seleciona (outline + handles); Shift adiciona; área vazia limpa', () => {
    renderApp();
    const alvo = screen.getByTestId('el-title/0');

    fireEvent.pointerDown(alvo, { pointerId: 1 });
    fireEvent.pointerUp(alvo, { pointerId: 1 });
    expect(alvo).toHaveAttribute('data-selecionado');
    expect(screen.getByTestId('handle-se-title/0')).toBeInTheDocument();

    const segundo = screen.getByTestId('el-title/1');
    fireEvent.pointerDown(segundo, { pointerId: 1, shiftKey: true });
    fireEvent.pointerUp(segundo, { pointerId: 1 });
    expect(useDocumentoStore.getState().selecao).toHaveLength(2);

    // Área vazia de outra banda limpa a seleção.
    fireEvent.pointerDown(screen.getByTestId('banda-pageFooter'));
    expect(useDocumentoStore.getState().selecao).toHaveLength(0);
  });

  it('arrastar o corpo move o elemento (clamp na banda)', () => {
    renderApp();
    const alvo = screen.getByTestId('el-title/0');

    fireEvent.pointerDown(alvo, { pointerId: 1, clientX: 50, clientY: 10 });
    fireEvent.pointerMove(alvo, { pointerId: 1, clientX: 80, clientY: 25 }); // +30, +15
    fireEvent.pointerUp(alvo, { pointerId: 1 });

    const bounds = useDocumentoStore.getState().template?.bands.title?.elements[0]?.bounds;
    expect(bounds).toEqual({ x: 30, y: 15, width: 300, height: 30 });
    expect(useDocumentoStore.getState().problemas).toEqual([]);

    // Continua arrastando muito além da borda → clampeia (banda 555×60).
    fireEvent.pointerDown(alvo, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(alvo, { pointerId: 1, clientX: 9999, clientY: 9999 });
    fireEvent.pointerUp(alvo, { pointerId: 1 });
    const clampeado = useDocumentoStore.getState().template?.bands.title?.elements[0]?.bounds;
    expect(clampeado).toEqual({ x: 255, y: 30, width: 300, height: 30 });
  });

  it('arrastar o handle SE redimensiona; o W move a borda esquerda', () => {
    renderApp();
    const alvo = screen.getByTestId('el-title/0');
    fireEvent.pointerDown(alvo, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerUp(alvo, { pointerId: 1 });

    const se = screen.getByTestId('handle-se-title/0');
    fireEvent.pointerDown(se, { pointerId: 1, clientX: 300, clientY: 30 });
    fireEvent.pointerMove(se, { pointerId: 1, clientX: 340, clientY: 50 }); // +40, +20
    fireEvent.pointerUp(se, { pointerId: 1 });
    expect(useDocumentoStore.getState().template?.bands.title?.elements[0]?.bounds).toEqual({
      x: 0,
      y: 0,
      width: 340,
      height: 50,
    });

    const w = screen.getByTestId('handle-w-title/0');
    fireEvent.pointerDown(w, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(w, { pointerId: 1, clientX: 20, clientY: 0 }); // borda esquerda +20
    fireEvent.pointerUp(w, { pointerId: 1 });
    expect(useDocumentoStore.getState().template?.bands.title?.elements[0]?.bounds).toEqual({
      x: 20,
      y: 0,
      width: 320,
      height: 50,
    });
  });

  it('aproximação visual: textField mostra a expressão; placeholders informativos', () => {
    renderApp();
    expect(screen.getByText('$P{titulo}')).toBeInTheDocument(); // textField do título
    expect(screen.getByText('imagem: $P{logo_url}')).toBeInTheDocument();
    expect(screen.getByText('tabela · $F{itens} · 2 col')).toBeInTheDocument();
    expect(screen.getByText('barcode QRCode')).toBeInTheDocument();
    expect(screen.getByText(/frame · 2 elemento/)).toBeInTheDocument();
  });
});
