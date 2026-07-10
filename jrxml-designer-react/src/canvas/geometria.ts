/**
 * Geometria do canvas (RFC-004 §3, tarefa phase-2/2.1).
 *
 * O relatório raciocina em PONTOS (pt, 72 dpi — unidade do JRXML); o usuário
 * pensa em MILÍMETROS; a tela desenha em PIXELS (pt × zoom). Este módulo é
 * puro e concentra todas as conversões — nenhum componente faz aritmética de
 * unidades por conta própria.
 */
import type { PageFormat } from '@reportlenz/jrxml-core';

/** 1 polegada = 72 pt = 25,4 mm. */
export const PT_POR_MM = 72 / 25.4;

export function mmParaPt(mm: number): number {
  return mm * PT_POR_MM;
}

export function ptParaMm(pt: number): number {
  return pt / PT_POR_MM;
}

/** pt → px de tela sob o zoom atual. */
export function ptParaPx(pt: number, zoom: number): number {
  return pt * zoom;
}

export function pxParaPt(px: number, zoom: number): number {
  return px / zoom;
}

// ---------------------------------------------------------------------------
// Réguas em mm (RFC-004 §3: "réguas em mm/cm além de pt")

export interface MarcaDeRegua {
  /** Posição em px de tela (já sob zoom). */
  px: number;
  /** Valor em mm inteiro. */
  mm: number;
  /** `maior` a cada 10mm (com rótulo), `media` a cada 5mm, `menor` a cada 1mm. */
  tipo: 'maior' | 'media' | 'menor';
}

/**
 * Marcas de régua para um eixo de `comprimentoPt`, milímetro a milímetro.
 * Sob zoom baixo as marcas de 1mm ficariam ilegíveis — quem consome decide
 * o corte (a régua desenha `menor` só quando zoom ≥ 1).
 */
export function marcasDeRegua(comprimentoPt: number, zoom: number): MarcaDeRegua[] {
  const totalMm = Math.floor(ptParaMm(comprimentoPt));
  const marcas: MarcaDeRegua[] = [];
  for (let mm = 0; mm <= totalMm; mm++) {
    marcas.push({
      px: ptParaPx(mmParaPt(mm), zoom),
      mm,
      tipo: mm % 10 === 0 ? 'maior' : mm % 5 === 0 ? 'media' : 'menor',
    });
  }
  return marcas;
}

// ---------------------------------------------------------------------------
// Página e colunas

export interface CaixaPt {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Área útil da página (dentro das margens), em pt. */
export function areaUtil(pf: PageFormat): CaixaPt {
  return {
    x: pf.leftMargin,
    y: pf.topMargin,
    width: pf.pageWidth - pf.leftMargin - pf.rightMargin,
    height: pf.pageHeight - pf.topMargin - pf.bottomMargin,
  };
}

/**
 * Caixas das colunas (multi-coluna p/ etiqueta A4, ADR-011), em pt.
 * Com columnCount=1 devolve uma única caixa = área útil.
 */
export function colunasDaPagina(pf: PageFormat): CaixaPt[] {
  const util = areaUtil(pf);
  const colunas: CaixaPt[] = [];
  for (let i = 0; i < pf.columnCount; i++) {
    colunas.push({
      x: util.x + i * (pf.columnWidth + pf.columnSpacing),
      y: util.y,
      width: pf.columnWidth,
      height: util.height,
    });
  }
  return colunas;
}

/** Linhas do grid (verticais e horizontais) da área útil, passo em mm. */
export interface LinhasDeGrid {
  verticaisPt: number[];
  horizontaisPt: number[];
}

export function linhasDeGrid(pf: PageFormat, passoMm: number): LinhasDeGrid {
  const util = areaUtil(pf);
  const passoPt = mmParaPt(passoMm);
  const verticaisPt: number[] = [];
  const horizontaisPt: number[] = [];
  for (let x = util.x; x <= util.x + util.width + 0.001; x += passoPt) {
    verticaisPt.push(x);
  }
  for (let y = util.y; y <= util.y + util.height + 0.001; y += passoPt) {
    horizontaisPt.push(y);
  }
  return { verticaisPt, horizontaisPt };
}
