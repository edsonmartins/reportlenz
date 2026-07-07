/**
 * Bandas e grupos (RFC-001 §3).
 */
import type { Element } from './elements.js';

/** Banda: faixa horizontal do relatório contendo elementos posicionados. */
export interface Band {
  height: number;
  splitType: 'Stretch' | 'Prevent' | 'Immediate';
  elements: Element[];
  printWhenExpression?: string;
}

/** Grupo com quebra por expressão (ex.: agrupar itens da fatura por seção). */
export interface Group {
  name: string;
  /** Expressão de quebra do grupo (ex.: `$F{categoria}`). */
  expression: string;
  header?: Band;
  footer?: Band;
  /** Reinicia a numeração de página a cada quebra do grupo. */
  startNewPage?: boolean;
}

/** Conjunto de bandas do relatório, na taxonomia do JRXML. */
export interface BandSet {
  title?: Band;
  background?: Band;
  pageHeader?: Band;
  columnHeader?: Band;
  /** Múltiplas detail bands são permitidas no JRXML. */
  detail: Band[];
  columnFooter?: Band;
  pageFooter?: Band;
  summary?: Band;
  /** Impressa quando o datasource está vazio. */
  noData?: Band;
  groups: Group[];
}
