import { MantineProvider } from '@mantine/core';
import { REFERENCIA_FATURA } from '@reportlenz/jrxml-core';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/App';
import { useCanvasStore } from '../src/store/canvasStore';
import { useDocumentoStore } from '../src/store/documentoStore';
import { alinharElementos, aplicarZOrder, bandaComum, distribuirElementos } from '../src/store/mutacoes';

/**
 * Tarefa phase-2/2.5 — multi-seleção: alinhar/distribuir/z-order.
 * z-order no JRXML = ordem dos elementos na banda (a seleção acompanha).
 */

const TITULO = { tipo: 'secao', secao: 'title' } as const;
const c = (indice: number) => ({ banda: TITULO, indice });

describe('jrxml-designer-react · comandos de seleção (2.5) — mutações puras', () => {
  // Título da fatura: tf(0,0,300×30), img(455,0,100×50), line(0,55,555×1)

  it('bandaComum exige a mesma banda', () => {
    expect(bandaComum([c(0), c(1)])).toEqual(TITULO);
    expect(bandaComum([c(0), { banda: { tipo: 'detail', indice: 0 }, indice: 0 }])).toBeNull();
    expect(bandaComum([])).toBeNull();
  });

  it('alinhar topos e esquerdas usa a caixa envolvente da seleção', () => {
    const comY = alinharElementos([c(0), c(1)], 'topo')(
      // desloca o textField para y=12 antes, p/ o alinhamento ter efeito
      { ...REFERENCIA_FATURA, bands: { ...REFERENCIA_FATURA.bands, title: { ...REFERENCIA_FATURA.bands.title!, elements: REFERENCIA_FATURA.bands.title!.elements.map((el, i) => (i === 0 ? { ...el, bounds: { ...el.bounds, y: 12 } } : el)) } } },
    );
    expect(comY.bands.title?.elements[0]?.bounds.y).toBe(0); // topo da envolvente
    expect(comY.bands.title?.elements[1]?.bounds.y).toBe(0);

    const esq = alinharElementos([c(0), c(1)], 'esquerda')(REFERENCIA_FATURA);
    expect(esq.bands.title?.elements[0]?.bounds.x).toBe(0);
    expect(esq.bands.title?.elements[1]?.bounds.x).toBe(0);

    const dir = alinharElementos([c(0), c(1)], 'direita')(REFERENCIA_FATURA);
    expect(dir.bands.title?.elements[0]?.bounds.x).toBe(255); // 555-300
    expect(dir.bands.title?.elements[1]?.bounds.x).toBe(455); // 555-100
  });

  it('distribuir horizontalmente iguala os vãos (primeiro e último ficam)', () => {
    // três elementos: x=0 w=100, x=120 w=100, x=400 w=100 → span 0..500, vãos = (500-300)/2 = 100
    const base = structuredClone(REFERENCIA_FATURA);
    base.bands.title!.elements = [
      { kind: 'staticText', bounds: { x: 0, y: 0, width: 100, height: 10 }, text: 'a' },
      { kind: 'staticText', bounds: { x: 120, y: 0, width: 100, height: 10 }, text: 'b' },
      { kind: 'staticText', bounds: { x: 400, y: 0, width: 100, height: 10 }, text: 'c' },
    ];
    const dist = distribuirElementos([c(0), c(1), c(2)], 'horizontal')(base);
    expect(dist.bands.title?.elements.map((e) => e.bounds.x)).toEqual([0, 200, 400]);
  });

  it('z-order: frente/trás reordenam a banda e a seleção acompanha', () => {
    const frente = aplicarZOrder(REFERENCIA_FATURA, [c(0)], 'frente');
    // textField foi para o fim (pintado por último = na frente)
    expect(frente.template.bands.title?.elements[2]?.kind).toBe('textField');
    expect(frente.selecao).toEqual([c(2)]);

    const tras = aplicarZOrder(REFERENCIA_FATURA, [c(1)], 'tras');
    expect(tras.template.bands.title?.elements[0]?.kind).toBe('image');
    expect(tras.selecao).toEqual([c(0)]);
  });
});

describe('jrxml-designer-react · comandos de seleção (2.5) — na UI', () => {
  beforeEach(() => {
    useDocumentoStore.getState().fecharDocumento();
    useCanvasStore.setState({ zoom: 1, mostrarGrid: false, passoGridMm: 5, snapAtivo: false, guiasDeSnap: null });
    useDocumentoStore.getState().novoDocumento(structuredClone(REFERENCIA_FATURA));
  });

  it('botões habilitam conforme a seleção; alinhar topos age nos dois', () => {
    render(
      <MantineProvider>
        <App />
      </MantineProvider>,
    );
    const alinharTopos = () => screen.getByRole('button', { name: '⊓' });
    expect(alinharTopos()).toBeDisabled();

    fireEvent.pointerDown(screen.getByTestId('el-title/0'), { pointerId: 1 });
    fireEvent.pointerUp(screen.getByTestId('el-title/0'), { pointerId: 1 });
    expect(alinharTopos()).toBeDisabled(); // 1 só não alinha

    fireEvent.pointerDown(screen.getByTestId('el-title/1'), { pointerId: 1, shiftKey: true });
    fireEvent.pointerUp(screen.getByTestId('el-title/1'), { pointerId: 1 });
    expect(alinharTopos()).toBeEnabled();

    // move o primeiro para y=12 e alinha topos de volta
    useDocumentoStore.getState().mutarTemplate((t) => {
      const p = structuredClone(t);
      p.bands.title!.elements[0]!.bounds.y = 12;
      return p;
    });
    fireEvent.click(alinharTopos());
    const titulo = useDocumentoStore.getState().template?.bands.title;
    expect(titulo?.elements[0]?.bounds.y).toBe(0);
    expect(titulo?.elements[1]?.bounds.y).toBe(0);
    expect(useDocumentoStore.getState().problemas).toEqual([]);
  });

  it('trazer para frente reordena e mantém o elemento selecionado', () => {
    render(
      <MantineProvider>
        <App />
      </MantineProvider>,
    );
    fireEvent.pointerDown(screen.getByTestId('el-title/0'), { pointerId: 1 });
    fireEvent.pointerUp(screen.getByTestId('el-title/0'), { pointerId: 1 });

    fireEvent.click(screen.getByRole('button', { name: '▲' }));

    const titulo = useDocumentoStore.getState().template?.bands.title;
    expect(titulo?.elements[2]?.kind).toBe('textField');
    // seleção acompanhou o novo índice — o mesmo elemento continua selecionado
    expect(screen.getByTestId('el-title/2')).toHaveAttribute('data-selecionado');
  });
});
