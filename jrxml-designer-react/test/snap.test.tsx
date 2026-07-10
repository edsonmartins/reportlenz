import { MantineProvider } from '@mantine/core';
import { REFERENCIA_FATURA } from '@reportlenz/jrxml-core';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/App';
import { alvosDeSnap, aplicarSnap } from '../src/canvas/snap';
import { useCanvasStore } from '../src/store/canvasStore';
import { useDocumentoStore } from '../src/store/documentoStore';

/**
 * Tarefa phase-2/2.4 — snapping com guias de alinhamento: alvos = bordas/
 * centros dos vizinhos + bordas da banda; elemento tem prioridade sobre grid;
 * Alt ignora pontualmente.
 */
describe('jrxml-designer-react · snap (2.4) — módulo puro', () => {
  const banda = REFERENCIA_FATURA.bands.title!; // tf(0,0,300×30), img(455,0,100×50), line(0,55,555×1)

  it('alvos incluem bordas/centros dos vizinhos e as bordas da banda', () => {
    const alvos = alvosDeSnap(banda, new Set([0]), 555);
    expect(alvos.xs).toContain(0); // borda da banda
    expect(alvos.xs).toContain(555); // borda da banda
    expect(alvos.xs).toContain(455); // esquerda da imagem
    expect(alvos.xs).toContain(505); // centro da imagem
    expect(alvos.ys).toContain(50); // base da imagem
    expect(alvos.ys).toContain(55); // topo da linha
    // O próprio elemento em arraste (índice 0) não é alvo.
    expect(alvos.xs).not.toContain(150); // centro do textField ignorado
  });

  it('snap na borda mais próxima dentro da tolerância; fora dela não mexe', () => {
    const alvos = alvosDeSnap(banda, new Set([0]), 555);
    // Borda direita do candidato em 453 → alvo 455 (esquerda da imagem), delta +2.
    const perto = aplicarSnap({ x: 153, y: 20, width: 300, height: 30 }, alvos, 4);
    expect(perto.bounds.x).toBe(155);
    expect(perto.guiaX).toBe(455);

    const longe = aplicarSnap({ x: 120, y: 20, width: 300, height: 30 }, alvos, 4);
    expect(longe.bounds.x).toBe(120);
    expect(longe.guiaX).toBeNull();
  });

  it('sem alvo de elemento, cai para o grid (sem guia); elemento tem prioridade', () => {
    // Banda sintética sem vizinhos: só as bordas (0,555 / 0,200) são alvos.
    const vazia = alvosDeSnap({ height: 200, splitType: 'Stretch', elements: [] }, new Set(), 555);
    const grid = aplicarSnap({ x: 123, y: 23, width: 300, height: 30 }, vazia, 4, 10);
    expect(grid.bounds.x).toBe(120);
    expect(grid.bounds.y).toBe(20);
    expect(grid.guiaX).toBeNull();
    expect(grid.guiaY).toBeNull();

    // Com alvo de elemento na tolerância, o grid NÃO interfere (453→455, não 450).
    const alvos = alvosDeSnap(banda, new Set([0]), 555);
    const prioridade = aplicarSnap({ x: 153, y: 100, width: 300, height: 30 }, alvos, 4, 10);
    expect(prioridade.bounds.x).toBe(155);
    expect(prioridade.guiaX).toBe(455);
  });
});

describe('jrxml-designer-react · snap (2.4) — no canvas', () => {
  beforeEach(() => {
    useDocumentoStore.getState().fecharDocumento();
    useCanvasStore.setState({ zoom: 1, mostrarGrid: false, passoGridMm: 5, snapAtivo: true, guiasDeSnap: null });
    useDocumentoStore.getState().novoDocumento(structuredClone(REFERENCIA_FATURA));
  });

  function renderApp() {
    return render(
      <MantineProvider>
        <App />
      </MantineProvider>,
    );
  }

  it('arraste perto do vizinho gruda e mostra a guia; soltar limpa a guia', () => {
    renderApp();
    const alvo = screen.getByTestId('el-title/0'); // 0,0 300×30

    fireEvent.pointerDown(alvo, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(alvo, { pointerId: 1, clientX: 153, clientY: 0 }); // direita em 453 ≈ 455
    expect(useDocumentoStore.getState().template?.bands.title?.elements[0]?.bounds.x).toBe(155);
    expect(screen.getByTestId('guia-snap-x')).toBeInTheDocument();
    expect(screen.getByTestId('guia-snap-x').style.left).toBe('455px');

    fireEvent.pointerUp(alvo, { pointerId: 1 });
    expect(screen.queryByTestId('guia-snap-x')).not.toBeInTheDocument();
  });

  it('Alt durante o arraste ignora o snap', () => {
    renderApp();
    const alvo = screen.getByTestId('el-title/0');

    fireEvent.pointerDown(alvo, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(alvo, { pointerId: 1, clientX: 153, clientY: 0, altKey: true });
    fireEvent.pointerUp(alvo, { pointerId: 1 });

    expect(useDocumentoStore.getState().template?.bands.title?.elements[0]?.bounds.x).toBe(153);
  });

  it('botão Snap desliga o comportamento', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'Snap' }));

    const alvo = screen.getByTestId('el-title/0');
    fireEvent.pointerDown(alvo, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(alvo, { pointerId: 1, clientX: 153, clientY: 0 });
    fireEvent.pointerUp(alvo, { pointerId: 1 });

    expect(useDocumentoStore.getState().template?.bands.title?.elements[0]?.bounds.x).toBe(153);
  });
});
