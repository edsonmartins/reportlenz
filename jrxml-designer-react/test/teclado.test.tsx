import { MantineProvider } from '@mantine/core';
import { REFERENCIA_FATURA } from '@reportlenz/jrxml-core';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/App';
import { useCanvasStore } from '../src/store/canvasStore';
import { useDocumentoStore } from '../src/store/documentoStore';

/**
 * Tarefa phase-2/2.6 — nudge (setas 1pt / Shift 10pt), delete e copy/paste
 * (clipboard interno em memória; colar re-seleciona as cópias).
 */

function renderApp() {
  return render(
    <MantineProvider>
      <App />
    </MantineProvider>,
  );
}

function selecionarTitulo0() {
  const alvo = screen.getByTestId('el-title/0');
  fireEvent.pointerDown(alvo, { pointerId: 1 });
  fireEvent.pointerUp(alvo, { pointerId: 1 });
}

const boundsTitulo0 = () => useDocumentoStore.getState().template?.bands.title?.elements[0]?.bounds;

describe('jrxml-designer-react · teclado e clipboard (2.6)', () => {
  beforeEach(() => {
    useDocumentoStore.getState().fecharDocumento();
    useCanvasStore.setState({ zoom: 1, mostrarGrid: false, passoGridMm: 5, snapAtivo: false, guiasDeSnap: null });
    useDocumentoStore.getState().novoDocumento(structuredClone(REFERENCIA_FATURA));
  });

  it('setas movem 1pt; com Shift movem 10pt; clamp na borda', () => {
    renderApp();
    selecionarTitulo0();

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(boundsTitulo0()?.x).toBe(1);

    fireEvent.keyDown(window, { key: 'ArrowDown', shiftKey: true });
    expect(boundsTitulo0()?.y).toBe(10);

    fireEvent.keyDown(window, { key: 'ArrowLeft', shiftKey: true });
    expect(boundsTitulo0()?.x).toBe(0); // 1-10 → clamp em 0
    expect(useDocumentoStore.getState().problemas).toEqual([]);
  });

  it('sem seleção, as setas não fazem nada', () => {
    renderApp();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(boundsTitulo0()?.x).toBe(0);
  });

  it('Delete remove a seleção e limpa a seleção', () => {
    renderApp();
    selecionarTitulo0();
    expect(useDocumentoStore.getState().template?.bands.title?.elements).toHaveLength(3);

    fireEvent.keyDown(window, { key: 'Delete' });

    const titulo = useDocumentoStore.getState().template?.bands.title;
    expect(titulo?.elements).toHaveLength(2);
    expect(titulo?.elements[0]?.kind).toBe('image'); // o textField saiu
    expect(useDocumentoStore.getState().selecao).toEqual([]);
  });

  it('Ctrl+C / Ctrl+V duplica com deslocamento e seleciona a cópia; colar de novo desloca mais', () => {
    renderApp();
    selecionarTitulo0();

    fireEvent.keyDown(window, { key: 'c', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'v', ctrlKey: true });

    let titulo = useDocumentoStore.getState().template?.bands.title;
    expect(titulo?.elements).toHaveLength(4);
    expect(titulo?.elements[3]?.bounds).toMatchObject({ x: 5, y: 5 }); // original 0,0 +5
    expect(useDocumentoStore.getState().selecao).toEqual([
      { banda: { tipo: 'secao', secao: 'title' }, indice: 3 },
    ]);

    fireEvent.keyDown(window, { key: 'v', metaKey: true }); // Cmd+V também
    titulo = useDocumentoStore.getState().template?.bands.title;
    expect(titulo?.elements).toHaveLength(5);
    expect(titulo?.elements[4]?.bounds).toMatchObject({ x: 10, y: 10 }); // +10 na 2ª colagem
    expect(useDocumentoStore.getState().problemas).toEqual([]);
  });

  it('copiar multi-seleção cola as duas cópias', () => {
    renderApp();
    selecionarTitulo0();
    const segundo = screen.getByTestId('el-title/1');
    fireEvent.pointerDown(segundo, { pointerId: 1, shiftKey: true });
    fireEvent.pointerUp(segundo, { pointerId: 1 });

    fireEvent.keyDown(window, { key: 'c', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'v', ctrlKey: true });

    const titulo = useDocumentoStore.getState().template?.bands.title;
    expect(titulo?.elements).toHaveLength(5); // 3 + 2 cópias
    expect(useDocumentoStore.getState().selecao).toHaveLength(2);
  });
});
