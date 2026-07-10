import { REFERENCIA_ETIQUETA_A4, REFERENCIA_FATURA } from '@reportlenz/jrxml-core';
import { describe, expect, it } from 'vitest';
import {
  PT_POR_MM,
  areaUtil,
  colunasDaPagina,
  linhasDeGrid,
  marcasDeRegua,
  mmParaPt,
  ptParaMm,
  ptParaPx,
} from '../src/canvas/geometria';

/**
 * Tarefa phase-2/2.1 — geometria pura do canvas: pt (JRXML) ↔ mm (usuário)
 * ↔ px (tela sob zoom).
 */
describe('jrxml-designer-react · geometria (2.1)', () => {
  it('conversões pt ↔ mm batem com a física (A4 = 210×297mm = 595×842pt)', () => {
    expect(PT_POR_MM).toBeCloseTo(2.8346, 3);
    expect(mmParaPt(210)).toBeCloseTo(595.27, 1);
    expect(mmParaPt(297)).toBeCloseTo(841.89, 1);
    expect(ptParaMm(595)).toBeCloseTo(209.9, 1);
    expect(ptParaMm(mmParaPt(42))).toBeCloseTo(42, 10);
  });

  it('px = pt × zoom', () => {
    expect(ptParaPx(595, 1)).toBe(595);
    expect(ptParaPx(595, 2)).toBe(1190);
    expect(ptParaPx(100, 0.5)).toBe(50);
  });

  it('marcas de régua: maior a cada 10mm com posição sob zoom', () => {
    const marcas = marcasDeRegua(595, 2); // A4 largura, zoom 200%
    const maiores = marcas.filter((m) => m.tipo === 'maior');
    expect(maiores.map((m) => m.mm)).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200]);
    const dez = maiores.find((m) => m.mm === 10);
    expect(dez?.px).toBeCloseTo(mmParaPt(10) * 2, 6);
    expect(marcas.find((m) => m.mm === 5)?.tipo).toBe('media');
    expect(marcas.find((m) => m.mm === 7)?.tipo).toBe('menor');
  });

  it('área útil desconta as margens do PageFormat', () => {
    const util = areaUtil(REFERENCIA_FATURA.pageFormat); // margens 20/20/30/30
    expect(util).toEqual({ x: 20, y: 30, width: 555, height: 782 });
  });

  it('colunas: fatura tem 1; etiqueta A4 tem 3 com espaçamento', () => {
    expect(colunasDaPagina(REFERENCIA_FATURA.pageFormat)).toHaveLength(1);

    const colunas = colunasDaPagina(REFERENCIA_ETIQUETA_A4.pageFormat); // 3×178 + 2×10
    expect(colunas).toHaveLength(3);
    expect(colunas[0]?.x).toBe(20);
    expect(colunas[1]?.x).toBe(20 + 178 + 10);
    expect(colunas[2]?.x).toBe(20 + 2 * (178 + 10));
    expect(colunas.every((c) => c.width === 178)).toBe(true);
  });

  it('grid cobre a área útil no passo pedido', () => {
    const grid = linhasDeGrid(REFERENCIA_FATURA.pageFormat, 5);
    // 555pt de largura ≈ 195.8mm → 40 linhas verticais (0..195mm de 5 em 5)
    expect(grid.verticaisPt).toHaveLength(40);
    expect(grid.verticaisPt[0]).toBe(20);
    expect(grid.horizontaisPt[0]).toBe(30);
    const passoPt = grid.verticaisPt[1]! - grid.verticaisPt[0]!;
    expect(ptParaMm(passoPt)).toBeCloseTo(5, 6);
  });
});
