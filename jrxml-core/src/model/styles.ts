/**
 * Estilos nomeados e condicionais (RFC-001 §3).
 */
import type { Box, HorizontalAlign, LineStyle, VerticalAlign } from './primitives.js';

/**
 * Propriedades visuais aplicáveis a estilos e a elementos de texto.
 * Todas opcionais: ausência significa "herdado" (a UI da Fase 2 pinta
 * herdado em cinza-claro e sobrescrito em preto — CLAUDE.md §6).
 */
export interface StyleProps {
  /** `Opaque` pinta o fundo; `Transparent` não. */
  mode?: 'Opaque' | 'Transparent';
  /** Cores em hex `#RRGGBB`. */
  forecolor?: string;
  backcolor?: string;
  fontName?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikeThrough?: boolean;
  hAlign?: HorizontalAlign;
  vAlign?: VerticalAlign;
  rotation?: 'None' | 'Left' | 'Right' | 'UpsideDown';
  /** Formatação de valor (ex.: `#,##0.00` para R$, `dd/MM/yyyy`). */
  pattern?: string;
  lineStyle?: LineStyle;
  box?: Box;
}

/** Estilo condicional: aplica `style` quando a expressão avalia `true`. */
export interface ConditionalStyle {
  conditionExpression: string;
  style: StyleProps;
}

/** Estilo nomeado do relatório, com herança opcional via `parentStyleRef`. */
export interface Style extends StyleProps {
  name: string;
  /** Nome do estilo pai (atributo `style` no JRXML). */
  parentStyleRef?: string;
  /** Estilo default do relatório (no máximo um). */
  isDefault?: boolean;
  conditionalStyles?: ConditionalStyle[];
}
