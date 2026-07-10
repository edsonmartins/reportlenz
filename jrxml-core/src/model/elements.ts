/**
 * Elementos de banda (RFC-001 §3) — subconjunto para fatura, comprovante,
 * formulário e etiqueta A4. Expansões (charts 2D etc.) são incrementais;
 * charts 3D não existem no JR7 (RFC-001 §7) e ficam fora do modelo.
 *
 * Expressões (`expression`, `printWhenExpression`, ...) usam a sintaxe
 * JasperReports (`$F{...}`/`$P{...}`/`$V{...}`) e são validadas contra o
 * contrato de dados pelo `validateContract` (tarefa 6.2) — nunca contra banco.
 */
import type { Bounds, Pen } from './primitives.js';
import type { ConditionalStyle, StyleProps } from './styles.js';

/** Propriedades comuns a todo elemento posicionado numa banda. */
export interface ElementBase {
  /** Atributo `key` do JRXML — identificação estável no design. */
  key?: string;
  bounds: Bounds;
  /** Referência a estilo nomeado do relatório. */
  styleRef?: string;
  /** Sobrescritas locais de estilo (vencem o `styleRef`). */
  style?: StyleProps;
  printWhenExpression?: string;
}

/** Texto fixo (rótulos de formulário, títulos). */
export interface StaticText extends ElementBase {
  kind: 'staticText';
  text: string;
}

/** Campo de texto orientado a expressão — o elemento central do produto. */
export interface TextField extends ElementBase {
  kind: 'textField';
  /** Ex.: `$F{cliente_nome}`, `$V{total_pagina}`. */
  expression: string;
  /** Formatação de valor (ex.: `¤ #,##0.00` pt-BR, `dd/MM/yyyy`). */
  pattern?: string;
  blankWhenNull?: boolean;
  /** Estica verticalmente para caber o conteúdo (textos longos). */
  textAdjust?: 'CutText' | 'StretchHeight' | 'ScaleFont';
  conditionalStyles?: ConditionalStyle[];
}

/** Linha (separadores de fatura/formulário). */
export interface Line extends ElementBase {
  kind: 'line';
  direction?: 'TopDown' | 'BottomUp';
  pen?: Pen;
}

/** Retângulo (molduras, fundos de seção). */
export interface Rectangle extends ElementBase {
  kind: 'rectangle';
  /** Raio dos cantos arredondados. */
  radius?: number;
  pen?: Pen;
}

/** Elipse. */
export interface Ellipse extends ElementBase {
  kind: 'ellipse';
  pen?: Pen;
}

/** Imagem (logotipo). A origem vem de expressão — nunca de banco. */
export interface ImageElement extends ElementBase {
  kind: 'image';
  /** Ex.: `$P{logo_url}` ou recurso embutido. */
  expression: string;
  scaleImage?: 'Clip' | 'FillFrame' | 'RetainShape' | 'RealHeight' | 'RealSize';
  onErrorType?: 'Error' | 'Blank' | 'Icon';
}

/** Tipos de código de barras cobertos pelo subconjunto (etiqueta A4, boleto). */
export type BarcodeType =
  | 'Code128'
  | 'Code39'
  | 'EAN13'
  | 'EAN8'
  | 'Interleaved2Of5'
  | 'QRCode'
  | 'DataMatrix'
  | 'PDF417';

/** Código de barras/QR (etiquetas A4, comprovantes). */
export interface BarcodeElement extends ElementBase {
  kind: 'barcode';
  barcodeType: BarcodeType;
  /** Expressão que produz o conteúdo codificado. */
  expression: string;
}

/**
 * Sub-relatório em modo Push: recebe template e datasource por expressão.
 * Não existe variante com conexão JDBC (ADR-003).
 */
export interface SubreportElement extends ElementBase {
  kind: 'subreport';
  /** Expressão que resolve o template do sub-relatório. */
  templateExpression: string;
  /** Expressão do datasource (coleção vinda do payload). */
  dataSourceExpression?: string;
  /** Parâmetros repassados: nome → expressão. */
  parameters: SubreportParameter[];
}

export interface SubreportParameter {
  name: string;
  expression: string;
}

/** Frame: contêiner com box próprio que agrupa elementos filhos. */
export interface FrameElement extends ElementBase {
  kind: 'frame';
  elements: Element[];
}

/**
 * Tabela em modo Push: alimentada por um campo-coleção do contrato de dados
 * (`datasetField`), nunca por query.
 */
export interface TableElement extends ElementBase {
  kind: 'table';
  /** Nome do campo (coleção) do contrato que alimenta as linhas. */
  datasetField: string;
  columns: ColunaDeTabela[];
}

/** Coluna simples ou grupo (merge de cabeçalho — `column kind="group"` no JR7). */
export type ColunaDeTabela = TableColumn | TableColumnGroup;

export interface TableColumn {
  width: number;
  header?: TableCell;
  detail: TableCell;
  footer?: TableCell;
}

/**
 * Grupo de colunas (Fase 3): o `header` é a célula MESCLADA que cobre as
 * colunas filhas; a largura é a soma das filhas. Aninhável.
 */
export interface TableColumnGroup {
  /** Largura total (soma das filhas — o JR exige o atributo). */
  width: number;
  header: TableCell;
  columns: ColunaDeTabela[];
}

/** Distingue grupo de coluna simples. */
export function eGrupoDeColunas(coluna: ColunaDeTabela): coluna is TableColumnGroup {
  return 'columns' in coluna;
}

/** Contagem de colunas FOLHA (o que o leitor vê como colunas). */
export function contarColunasFolha(colunas: ColunaDeTabela[]): number {
  return colunas.reduce((n, c) => n + (eGrupoDeColunas(c) ? contarColunasFolha(c.columns) : 1), 0);
}

export interface TableCell {
  height: number;
  styleRef?: string;
  elements: Element[];
}

/** União discriminada de todos os elementos do subconjunto (RFC-001 §3). */
export type Element =
  | StaticText
  | TextField
  | Line
  | Rectangle
  | Ellipse
  | ImageElement
  | BarcodeElement
  | SubreportElement
  | FrameElement
  | TableElement;

/** Discriminante de `Element` (`element.kind`). */
export type ElementKind = Element['kind'];
