/**
 * Serializer modelo → JRXML 7 (RFC-001 §4-§5, tarefa phase-0/5.1).
 *
 * Emite o dialeto 7 observado na Library 7.0.7 (nota de design 002): raiz sem
 * namespace, `<element kind="...">` unificado, expressões em CDATA. A ordem de
 * elementos segue os samples oficiais; a autoridade final de aceitação é o
 * harness Java com o load da Library (ADR-013, tarefa 5.2).
 *
 * Por construção não existe caminho que emita `<query>`/`<queryString>`
 * (ADR-003): o modelo não tem onde guardar query.
 */
import type { Band, Group } from '../model/bands.js';
import type { DataContract, FieldDecl } from '../model/contract.js';
import type { BarcodeElement, ColunaDeTabela, Element, FrameElement, ImageElement, SubreportElement, TableCell, TableElement, TextField } from '../model/elements.js';
import { eGrupoDeColunas } from '../model/elements.js';
import { PROPRIEDADE_DATASOURCE } from '../model/datasource.js';
import type { Pen } from '../model/primitives.js';
import type { ReportTemplate } from '../model/report.js';
import type { Style, StyleProps } from '../model/styles.js';
import { javaClassFromScalarType } from '../parse/javaTypes.js';

// ---------------------------------------------------------------------------
// Infra de escrita

const INDENT = '\t';

class Writer {
  private lines: string[] = [];
  private depth = 0;

  line(s: string): void {
    this.lines.push(INDENT.repeat(this.depth) + s);
  }

  /** Abre elemento, executa o corpo indentado e fecha. */
  block(open: string, close: string, body: () => void): void {
    this.line(open);
    this.depth += 1;
    body();
    this.depth -= 1;
    this.line(close);
  }

  toString(): string {
    return this.lines.join('\n') + '\n';
  }
}

/** Escapa valor de atributo XML. */
function esc(s: string): string {
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

/** Corpo em CDATA (expressões e textos), com split de `]]>` embutido. */
function cdata(s: string): string {
  return `<![CDATA[${s.replaceAll(']]>', ']]]]><![CDATA[>')}]]>`;
}

/** Formata pares atributo=valor, omitindo undefined. */
function attrs(pairs: Array<[string, string | number | boolean | undefined]>): string {
  const parts: string[] = [];
  for (const [k, v] of pairs) {
    if (v === undefined) continue;
    parts.push(`${k}="${typeof v === 'string' ? esc(v) : String(v)}"`);
  }
  return parts.length > 0 ? ' ' + parts.join(' ') : '';
}

// ---------------------------------------------------------------------------
// Estilo

/** Atributos de StyleProps na ordem de emissão dos samples 7. */
function styleAttrs(s: StyleProps | undefined): Array<[string, string | number | boolean | undefined]> {
  if (!s) return [];
  return [
    ['mode', s.mode],
    ['forecolor', s.forecolor],
    ['backcolor', s.backcolor],
    ['fontName', s.fontName],
    ['fontSize', s.fontSize],
    ['bold', s.bold],
    ['italic', s.italic],
    ['underline', s.underline],
    ['strikeThrough', s.strikeThrough],
    ['hTextAlign', s.hAlign],
    ['vTextAlign', s.vAlign],
    ['rotation', s.rotation],
  ];
}

function writeStyle(w: Writer, style: Style): void {
  const open = `<style${attrs([
    ['name', style.name],
    ['default', style.isDefault],
    ['style', style.parentStyleRef],
    ...styleAttrs(style),
  ])}`;
  const conditionals = style.conditionalStyles ?? [];
  if (conditionals.length === 0) {
    w.line(`${open}/>`);
    return;
  }
  w.block(`${open}>`, '</style>', () => {
    for (const cs of conditionals) {
      w.block(`<conditionalStyle${attrs(styleAttrs(cs.style))}>`, '</conditionalStyle>', () => {
        w.line(`<conditionExpression>${cdata(cs.conditionExpression)}</conditionExpression>`);
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Contrato

/** Classe Java de um field (coleções viram java.util.List). */
function fieldJavaClass(f: FieldDecl): string {
  return f.type === 'collection' ? 'java.util.List' : javaClassFromScalarType(f.type);
}

/** Nome do `<dataset>` emitido para um campo-coleção com itemFields. */
function datasetNameFor(fieldName: string): string {
  return `${fieldName}_ds`;
}

function writeContract(w: Writer, contract: DataContract, campoDatasource?: string): void {
  // Datasets primeiro (itens de coleções), como nos samples (dataset antes de parameter/field).
  // A coleção-DATASOURCE (ADR-015) não vira dataset: os itens dela são o MESTRE.
  for (const f of contract.fields) {
    if (f.type !== 'collection' || !f.itemFields?.length || f.name === campoDatasource) continue;
    w.block(`<dataset${attrs([['name', datasetNameFor(f.name)]])}>`, '</dataset>', () => {
      for (const item of f.itemFields ?? []) {
        writeFieldDecl(w, item);
      }
    });
  }

  for (const p of contract.parameters) {
    const open = `<parameter${attrs([
      ['name', p.name],
      ['class', javaClassFromScalarType(p.type)],
    ])}`;
    if (p.description === undefined && p.defaultValueExpression === undefined) {
      w.line(`${open}/>`);
      continue;
    }
    w.block(`${open}>`, '</parameter>', () => {
      if (p.description !== undefined) w.line(`<description>${cdata(p.description)}</description>`);
      if (p.defaultValueExpression !== undefined) {
        w.line(`<defaultValueExpression>${cdata(p.defaultValueExpression)}</defaultValueExpression>`);
      }
    });
  }

  for (const f of contract.fields) {
    if (f.name === campoDatasource && f.type === 'collection') {
      // ADR-015: os `<field>` mestre são os itemFields (linha = item da coleção).
      for (const item of f.itemFields ?? []) {
        writeFieldDecl(w, item);
      }
      continue;
    }
    writeFieldDecl(w, f);
  }

  for (const v of contract.variables) {
    const open = `<variable${attrs([
      ['name', v.name],
      ['resetType', v.resetType],
      ['resetGroup', v.resetGroup],
      ['calculation', v.calculation === 'Nothing' ? undefined : v.calculation],
      ['class', javaClassFromScalarType(v.type)],
    ])}`;
    if (v.expression === undefined && v.initialValueExpression === undefined) {
      w.line(`${open}/>`);
      continue;
    }
    w.block(`${open}>`, '</variable>', () => {
      if (v.expression !== undefined) w.line(`<expression>${cdata(v.expression)}</expression>`);
      if (v.initialValueExpression !== undefined) {
        w.line(`<initialValueExpression>${cdata(v.initialValueExpression)}</initialValueExpression>`);
      }
    });
  }
}

function writeFieldDecl(w: Writer, f: FieldDecl): void {
  const open = `<field${attrs([
    ['name', f.name],
    ['class', fieldJavaClass(f)],
  ])}`;
  if (f.description === undefined) {
    w.line(`${open}/>`);
    return;
  }
  w.block(`${open}>`, '</field>', () => {
    w.line(`<description>${cdata(f.description ?? '')}</description>`);
  });
}

// ---------------------------------------------------------------------------
// Elementos

/** Atributos comuns de `<element>`: kind, posição, estilo e referência. */
function elementOpenAttrs(el: Element, kind: string): string {
  return attrs([
    ['kind', kind],
    ['key', el.key],
    ['x', el.bounds.x],
    ['y', el.bounds.y],
    ['width', el.bounds.width],
    ['height', el.bounds.height],
    ...styleAttrs(el.style),
    ['style', el.styleRef],
  ]);
}

function writePen(w: Writer, pen: Pen | undefined): void {
  if (!pen) return;
  w.line(`<pen${attrs([
    ['lineWidth', pen.lineWidth],
    ['lineStyle', pen.lineStyle],
    ['lineColor', pen.lineColor],
  ])}/>`);
}

function writePrintWhen(w: Writer, el: Element): void {
  if (el.printWhenExpression !== undefined) {
    w.line(`<printWhenExpression>${cdata(el.printWhenExpression)}</printWhenExpression>`);
  }
}

function writeTextField(w: Writer, el: TextField): void {
  const open = `<element${elementOpenAttrs(el, 'textField')}${attrs([
    ['pattern', el.pattern],
    ['blankWhenNull', el.blankWhenNull],
    ['textAdjust', el.textAdjust],
  ])}>`;
  w.block(open, '</element>', () => {
    w.line(`<expression>${cdata(el.expression)}</expression>`);
    writePrintWhen(w, el);
  });
}

function writeImage(w: Writer, el: ImageElement): void {
  const open = `<element${elementOpenAttrs(el, 'image')}${attrs([
    ['scaleImage', el.scaleImage],
    ['onErrorType', el.onErrorType],
  ])}>`;
  w.block(open, '</element>', () => {
    w.line(`<expression>${cdata(el.expression)}</expression>`);
    writePrintWhen(w, el);
  });
}

function writeBarcode(w: Writer, el: BarcodeElement): void {
  w.block(`<element${elementOpenAttrs(el, 'component')}>`, '</element>', () => {
    w.block(`<component${attrs([['kind', `barcode4j:${el.barcodeType}`]])}>`, '</component>', () => {
      w.line(`<codeExpression>${cdata(el.expression)}</codeExpression>`);
    });
    writePrintWhen(w, el);
  });
}

function writeTableCell(w: Writer, tag: string, cell: TableCell): void {
  const open = `<${tag}${attrs([
    ['height', cell.height],
    ['style', cell.styleRef],
  ])}>`;
  w.block(open, `</${tag}>`, () => {
    for (const el of cell.elements) writeElement(w, el);
  });
}

function writeTable(w: Writer, el: TableElement): void {
  w.block(`<element${elementOpenAttrs(el, 'component')}>`, '</element>', () => {
    w.block('<component kind="table">', '</component>', () => {
      w.block(`<datasetRun${attrs([['subDataset', datasetNameFor(el.datasetField)]])}>`, '</datasetRun>', () => {
        w.line(
          `<dataSourceExpression>${cdata(
            `new net.sf.jasperreports.engine.data.JRBeanCollectionDataSource($F{${el.datasetField}})`,
          )}</dataSourceExpression>`,
        );
      });
      writeColunas(w, el.columns);
    });
    writePrintWhen(w, el);
  });
}

/** Colunas simples e grupos (merge de cabeçalho), recursivo — dialeto 7. */
function writeColunas(w: Writer, colunas: ColunaDeTabela[]): void {
  for (const col of colunas) {
    if (eGrupoDeColunas(col)) {
      w.block(`<column${attrs([['kind', 'group'], ['width', col.width]])}>`, '</column>', () => {
        writeTableCell(w, 'columnHeader', col.header);
        writeColunas(w, col.columns);
      });
      continue;
    }
    w.block(`<column${attrs([['kind', 'single'], ['width', col.width]])}>`, '</column>', () => {
      if (col.header) writeTableCell(w, 'columnHeader', col.header);
      writeTableCell(w, 'detailCell', col.detail);
      if (col.footer) writeTableCell(w, 'columnFooter', col.footer);
    });
  }
}

function writeSubreport(w: Writer, el: SubreportElement): void {
  w.block(`<element${elementOpenAttrs(el, 'subreport')}>`, '</element>', () => {
    if (el.dataSourceExpression !== undefined) {
      w.line(`<dataSourceExpression>${cdata(el.dataSourceExpression)}</dataSourceExpression>`);
    }
    w.line(`<expression>${cdata(el.templateExpression)}</expression>`);
    for (const p of el.parameters) {
      w.block(`<parameter${attrs([['name', p.name]])}>`, '</parameter>', () => {
        w.line(`<expression>${cdata(p.expression)}</expression>`);
      });
    }
    writePrintWhen(w, el);
  });
}

function writeFrame(w: Writer, el: FrameElement): void {
  w.block(`<element${elementOpenAttrs(el, 'frame')}>`, '</element>', () => {
    for (const inner of el.elements) writeElement(w, inner);
    writePrintWhen(w, el);
  });
}

function writeElement(w: Writer, el: Element): void {
  switch (el.kind) {
    case 'staticText':
      w.block(`<element${elementOpenAttrs(el, 'staticText')}>`, '</element>', () => {
        w.line(`<text>${cdata(el.text)}</text>`);
        writePrintWhen(w, el);
      });
      return;
    case 'textField':
      writeTextField(w, el);
      return;
    case 'line':
      writeShape(w, el, 'line', [['direction', el.direction]], el.pen);
      return;
    case 'rectangle':
      writeShape(w, el, 'rectangle', [['radius', el.radius]], el.pen);
      return;
    case 'ellipse':
      writeShape(w, el, 'ellipse', [], el.pen);
      return;
    case 'image':
      writeImage(w, el);
      return;
    case 'barcode':
      writeBarcode(w, el);
      return;
    case 'table':
      writeTable(w, el);
      return;
    case 'subreport':
      writeSubreport(w, el);
      return;
    case 'frame':
      writeFrame(w, el);
      return;
  }
  // O switch acima é exaustivo para o tipo Element; dados de RUNTIME fora do
  // modelo (ex.: estado corrompido vindo da UI) não podem sumir em silêncio.
  throw new Error(
    `elemento com kind desconhecido não pode ser serializado: ${JSON.stringify((el as { kind?: unknown }).kind)}`,
  );
}

function writeShape(
  w: Writer,
  el: Element,
  kind: string,
  extra: Array<[string, string | number | boolean | undefined]>,
  pen: Pen | undefined,
): void {
  const open = `<element${elementOpenAttrs(el, kind)}${attrs(extra)}`;
  if (!pen && el.printWhenExpression === undefined) {
    w.line(`${open}/>`);
    return;
  }
  w.block(`${open}>`, '</element>', () => {
    writePen(w, pen);
    writePrintWhen(w, el);
  });
}

// ---------------------------------------------------------------------------
// Bandas, seções e grupos

/**
 * Emite uma banda usando `tag` como nome do elemento. No dialeto 7, seções de
 * banda única (`<title>`, `<summary>`, ...) SÃO a banda — height/splitType
 * ficam direto na tag da seção (verificado pelo harness: JRDesignBand não
 * aceita `<band>` aninhado nessas posições). Apenas `<detail>` e
 * `groupHeader/groupFooter` envelopam `<band>`.
 */
function writeBandAs(w: Writer, tag: string, band: Band): void {
  const open = `<${tag}${attrs([
    ['height', band.height],
    ['splitType', band.splitType === 'Stretch' ? undefined : band.splitType],
  ])}`;
  if (band.elements.length === 0 && band.printWhenExpression === undefined) {
    w.line(`${open}/>`);
    return;
  }
  w.block(`${open}>`, `</${tag}>`, () => {
    if (band.printWhenExpression !== undefined) {
      w.line(`<printWhenExpression>${cdata(band.printWhenExpression)}</printWhenExpression>`);
    }
    for (const el of band.elements) writeElement(w, el);
  });
}

function writeBandSection(w: Writer, tag: string, band: Band | undefined): void {
  if (!band) return;
  writeBandAs(w, tag, band);
}

function writeGroup(w: Writer, group: Group): void {
  w.block(`<group${attrs([['name', group.name], ['startNewPage', group.startNewPage]])}>`, '</group>', () => {
    w.line(`<expression>${cdata(group.expression)}</expression>`);
    const { header, footer } = group;
    if (header) {
      w.block('<groupHeader>', '</groupHeader>', () => writeBandAs(w, 'band', header));
    }
    if (footer) {
      w.block('<groupFooter>', '</groupFooter>', () => writeBandAs(w, 'band', footer));
    }
  });
}

// ---------------------------------------------------------------------------
// Raiz

/**
 * Serializa um `ReportTemplate` em JRXML 7 (RFC-001 §4).
 * Determinístico: mesmo modelo → mesmo XML, byte a byte.
 */
export function serializeJrxml(t: ReportTemplate): string {
  const w = new Writer();
  const pf = t.pageFormat;

  const rootOpen = `<jasperReport${attrs([
    ['name', t.name],
    ['columnCount', pf.columnCount === 1 ? undefined : pf.columnCount],
    ['pageWidth', pf.pageWidth],
    ['pageHeight', pf.pageHeight],
    ['orientation', pf.orientation === 'Portrait' ? undefined : pf.orientation],
    ['columnWidth', pf.columnWidth],
    ['columnSpacing', pf.columnSpacing === 0 ? undefined : pf.columnSpacing],
    ['printOrder', pf.printOrder === 'Horizontal' ? 'Horizontal' : undefined],
    ['leftMargin', pf.leftMargin],
    ['rightMargin', pf.rightMargin],
    ['topMargin', pf.topMargin],
    ['bottomMargin', pf.bottomMargin],
  ])}>`;

  w.block(rootOpen, '</jasperReport>', () => {
    for (const [name, value] of Object.entries(t.properties)) {
      w.line(`<property${attrs([['name', name], ['value', value]])}/>`);
    }
    for (const style of t.styles) writeStyle(w, style);
    writeContract(w, t.dataContract, t.properties[PROPRIEDADE_DATASOURCE]);
    for (const group of t.bands.groups) writeGroup(w, group);
    writeBandSection(w, 'background', t.bands.background);
    writeBandSection(w, 'title', t.bands.title);
    writeBandSection(w, 'pageHeader', t.bands.pageHeader);
    writeBandSection(w, 'columnHeader', t.bands.columnHeader);
    if (t.bands.detail.length > 0) {
      w.block('<detail>', '</detail>', () => {
        for (const band of t.bands.detail) writeBandAs(w, 'band', band);
      });
    }
    writeBandSection(w, 'columnFooter', t.bands.columnFooter);
    writeBandSection(w, 'pageFooter', t.bands.pageFooter);
    writeBandSection(w, 'summary', t.bands.summary);
    writeBandSection(w, 'noData', t.bands.noData);
  });

  return `<?xml version="1.0" encoding="UTF-8"?>\n${w.toString()}`;
}
