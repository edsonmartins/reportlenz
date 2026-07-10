/**
 * Modelo de domínio do jrxml-core (RFC-001 §3).
 */
export type { Bounds, Box, HorizontalAlign, LineStyle, PageFormat, Pen, VerticalAlign } from './primitives.js';
export type { ConditionalStyle, Style, StyleProps } from './styles.js';
export type {
  BarcodeElement,
  BarcodeType,
  ColunaDeTabela,
  Element,
  ElementBase,
  ElementKind,
  Ellipse,
  FrameElement,
  ImageElement,
  Line,
  Rectangle,
  StaticText,
  SubreportElement,
  SubreportParameter,
  TableCell,
  TableColumn,
  TableColumnGroup,
  TableElement,
  TextField,
} from './elements.js';
export { contarColunasFolha, eGrupoDeColunas } from './elements.js';
export type { Band, BandSet, Group } from './bands.js';
export type {
  DataContract,
  FieldDecl,
  FieldType,
  ParamDecl,
  ScalarType,
  VariableCalculation,
  VariableDecl,
  VariableResetType,
} from './contract.js';
export type { ReportTemplate } from './report.js';
