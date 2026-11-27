/**
 * Blocos de construção dos modelos de referência do catálogo (ADR-022).
 *
 * São funções PURAS que devolvem objetos do modelo — o resultado é idêntico a
 * escrever o literal à mão (o round-trip compara os objetos), só que sem
 * repetir bounds/estilos em dezenas de caixas (DANFE, boleto).
 */
import type { Element, Rectangle, StaticText, TextField } from '../model/elements.js';
import type { PageFormat } from '../model/primitives.js';
import type { StyleProps } from '../model/styles.js';

/** A4 retrato, margens 20/20/30/30 — área útil de 555pt. */
export function a4Retrato(extra: Partial<PageFormat> = {}): PageFormat {
  return {
    pageWidth: 595,
    pageHeight: 842,
    orientation: 'Portrait',
    leftMargin: 20,
    rightMargin: 20,
    topMargin: 30,
    bottomMargin: 30,
    columnCount: 1,
    columnWidth: 555,
    columnSpacing: 0,
    ...extra,
  };
}

/** A4 paisagem, margens 20 — área útil de 802pt. */
export function a4Paisagem(): PageFormat {
  return {
    pageWidth: 842,
    pageHeight: 595,
    orientation: 'Landscape',
    leftMargin: 20,
    rightMargin: 20,
    topMargin: 20,
    bottomMargin: 20,
    columnCount: 1,
    columnWidth: 802,
    columnSpacing: 0,
  };
}

/** Grade multi-coluna em A4 retrato (etiquetas/crachás, ADR-015). */
export function a4Grade(colunas: number, espacamento: number): PageFormat {
  const util = 555;
  return a4Retrato({
    columnCount: colunas,
    columnWidth: Math.floor((util - espacamento * (colunas - 1)) / colunas),
    columnSpacing: espacamento,
    printOrder: 'Horizontal',
  });
}

export function texto(
  x: number,
  y: number,
  width: number,
  height: number,
  text: string,
  extra: Partial<Omit<StaticText, 'kind' | 'bounds' | 'text'>> = {},
): StaticText {
  return { kind: 'staticText', bounds: { x, y, width, height }, text, ...extra };
}

export function campo(
  x: number,
  y: number,
  width: number,
  height: number,
  expression: string,
  extra: Partial<Omit<TextField, 'kind' | 'bounds' | 'expression'>> = {},
): TextField {
  return { kind: 'textField', bounds: { x, y, width, height }, expression, ...extra };
}

export function moldura(x: number, y: number, width: number, height: number, lineWidth = 0.5): Rectangle {
  return { kind: 'rectangle', bounds: { x, y, width, height }, pen: { lineWidth } };
}

/**
 * Caixa rotulada no estilo dos documentos fiscais/bancários: moldura, rótulo
 * pequeno em caixa-alta (estilo `rotulo`) e o valor logo abaixo.
 */
export function caixaRotulada(
  x: number,
  y: number,
  width: number,
  height: number,
  rotulo: string,
  expression: string,
  valor: Partial<Omit<TextField, 'kind' | 'bounds' | 'expression'>> = {},
): Element[] {
  return [
    moldura(x, y, width, height),
    texto(x + 2, y + 1, width - 4, 7, rotulo, { styleRef: 'rotulo' }),
    campo(x + 2, y + 8, width - 4, height - 9, expression, { blankWhenNull: true, ...valor }),
  ];
}

/** Linha tracejada de corte/destaque (canhoto, recibo do pagador). */
export function linhaDeCorte(y: number, width = 555): Element {
  return { kind: 'line', bounds: { x: 0, y, width, height: 1 }, pen: { lineWidth: 0.5, lineStyle: 'Dashed' } };
}

export const DIREITA: StyleProps = { hAlign: 'Right' };
export const NEGRITO: StyleProps = { bold: true };
