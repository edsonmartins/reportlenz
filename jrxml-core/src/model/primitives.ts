/**
 * Primitivos do modelo de domínio (RFC-001 §3).
 * Todas as medidas são em pontos (pt, 72 dpi), como no JRXML.
 */

/** Posição e dimensão de um elemento dentro da banda. */
export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Formato de página do relatório. `columnCount > 1` cobre etiquetas A4
 * multi-coluna (laser) — térmica está fora de escopo (ADR-011).
 */
export interface PageFormat {
  pageWidth: number;
  pageHeight: number;
  orientation: 'Portrait' | 'Landscape';
  leftMargin: number;
  rightMargin: number;
  topMargin: number;
  bottomMargin: number;
  columnCount: number;
  columnWidth: number;
  columnSpacing: number;
  /**
   * Ordem de preenchimento das colunas (grade de etiquetas A4, Fase 3):
   * `Vertical` (default do engine) desce a coluna; `Horizontal` atravessa.
   */
  printOrder?: 'Vertical' | 'Horizontal';
}

/** Alinhamentos de texto (nomes do JRXML 7). */
export type HorizontalAlign = 'Left' | 'Center' | 'Right' | 'Justified';
export type VerticalAlign = 'Top' | 'Middle' | 'Bottom';

/** Traço de linhas e bordas. */
export type LineStyle = 'Solid' | 'Dashed' | 'Dotted' | 'Double';

/** Caneta (pen) de linhas, formas e bordas de box. */
export interface Pen {
  lineWidth?: number;
  lineStyle?: LineStyle;
  /** Cor em hex `#RRGGBB`. */
  lineColor?: string;
}

/** Bordas de um box (células, frames, campos com moldura). */
export interface Box {
  pen?: Pen;
  topPen?: Pen;
  leftPen?: Pen;
  bottomPen?: Pen;
  rightPen?: Pen;
  padding?: number;
  topPadding?: number;
  leftPadding?: number;
  bottomPadding?: number;
  rightPadding?: number;
}
