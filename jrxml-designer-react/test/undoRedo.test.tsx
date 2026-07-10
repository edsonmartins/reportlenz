import { MantineProvider } from '@mantine/core';
import { REFERENCIA_FATURA } from '@reportlenz/jrxml-core';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/App';
import { useCanvasStore } from '../src/store/canvasStore';
import { useDocumentoStore } from '../src/store/documentoStore';

/**
 * Tarefa phase-2/2.7 — undo/redo com histórico de snapshots imutáveis;
 * arrastes coalescem por GESTO (1 drag = 1 entrada, não 1 por movimento).
 */

function renderApp() {
  return render(
    <MantineProvider>
      <App />
    </MantineProvider>,
  );
}

const boundsTitulo0 = () => useDocumentoStore.getState().template?.bands.title?.elements[0]?.bounds;

describe('jrxml-designer-react · undo/redo (2.7)', () => {
  beforeEach(() => {
    useDocumentoStore.getState().fecharDocumento();
    useCanvasStore.setState({ zoom: 1, mostrarGrid: false, passoGridMm: 5, snapAtivo: false, guiasDeSnap: null });
    useDocumentoStore.getState().novoDocumento(structuredClone(REFERENCIA_FATURA));
  });

  it('ciclo básico: mutar → desfazer → refazer (com revalidação)', () => {
    const s = () => useDocumentoStore.getState();
    s().mutarTemplate((t) => ({ ...t, name: 'v2' }));
    s().mutarTemplate((t) => ({ ...t, name: 'v3' }));
    expect(s().template?.name).toBe('v3');
    expect(s().passado).toHaveLength(2);

    s().desfazer();
    expect(s().template?.name).toBe('v2');
    s().desfazer();
    expect(s().template?.name).toBe('fatura_completa');
    expect(s().passado).toHaveLength(0);

    s().refazer();
    expect(s().template?.name).toBe('v2');
    expect(s().futuro).toHaveLength(1);
  });

  it('nova mutação após desfazer limpa o futuro (galho descartado)', () => {
    const s = () => useDocumentoStore.getState();
    s().mutarTemplate((t) => ({ ...t, name: 'v2' }));
    s().desfazer();
    s().mutarTemplate((t) => ({ ...t, name: 'outro-galho' }));
    expect(s().futuro).toHaveLength(0);
    s().refazer(); // não há o que refazer
    expect(s().template?.name).toBe('outro-galho');
  });

  it('gesto coalesce: um drag com vários movimentos = 1 entrada de undo', () => {
    renderApp();
    const alvo = screen.getByTestId('el-title/0');

    fireEvent.pointerDown(alvo, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(alvo, { pointerId: 1, clientX: 10, clientY: 0 });
    fireEvent.pointerMove(alvo, { pointerId: 1, clientX: 20, clientY: 5 });
    fireEvent.pointerMove(alvo, { pointerId: 1, clientX: 30, clientY: 15 });
    fireEvent.pointerUp(alvo, { pointerId: 1 });

    expect(boundsTitulo0()).toMatchObject({ x: 30, y: 15 });
    expect(useDocumentoStore.getState().passado).toHaveLength(1); // 1 gesto, não 3

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(boundsTitulo0()).toMatchObject({ x: 0, y: 0 });

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true }); // redo
    expect(boundsTitulo0()).toMatchObject({ x: 30, y: 15 });
  });

  it('clique sem arrastar não suja o histórico', () => {
    renderApp();
    const alvo = screen.getByTestId('el-title/0');
    fireEvent.pointerDown(alvo, { pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerUp(alvo, { pointerId: 1 });
    expect(useDocumentoStore.getState().passado).toHaveLength(0);
  });

  it('desfazer um delete traz o elemento de volta', () => {
    renderApp();
    const alvo = screen.getByTestId('el-title/0');
    fireEvent.pointerDown(alvo, { pointerId: 1 });
    fireEvent.pointerUp(alvo, { pointerId: 1 });
    fireEvent.keyDown(window, { key: 'Delete' });
    expect(useDocumentoStore.getState().template?.bands.title?.elements).toHaveLength(2);

    fireEvent.keyDown(window, { key: 'z', metaKey: true }); // Cmd+Z
    expect(useDocumentoStore.getState().template?.bands.title?.elements).toHaveLength(3);
    expect(useDocumentoStore.getState().problemas).toEqual([]);
  });

  it('botões da toolbar habilitam conforme o histórico', () => {
    renderApp();
    const desfazer = () => screen.getByRole('button', { name: 'desfazer' });
    const refazer = () => screen.getByRole('button', { name: 'refazer' });

    expect(desfazer()).toBeDisabled();
    expect(refazer()).toBeDisabled();

    act(() => {
      useDocumentoStore.getState().mutarTemplate((t) => ({ ...t, name: 'v2' }));
    });
    expect(desfazer()).toBeEnabled();

    fireEvent.click(desfazer());
    expect(useDocumentoStore.getState().template?.name).toBe('fatura_completa');
    expect(refazer()).toBeEnabled();

    fireEvent.click(refazer());
    expect(useDocumentoStore.getState().template?.name).toBe('v2');
  });
});
