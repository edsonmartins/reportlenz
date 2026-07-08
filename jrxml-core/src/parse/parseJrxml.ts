/**
 * Parser JRXML 7 → modelo de domínio (RFC-001 §4-§5, tarefa phase-0/4.1).
 *
 * Mira exclusivamente o dialeto 7 observado na Library 7.0.7 (nota de design
 * 002): raiz `<jasperReport>` sem namespace, elementos unificados
 * `<element kind="...">`, contrato declarado em `<field>/<parameter>/<variable>`.
 *
 * Erros são acumulados com caminho estruturado (ReportChecker) e o parse é
 * best-effort: retorna `ok` somente sem nenhum erro. Exceção: documentos de
 * dialeto 6.x (LEGACY_DIALECT) ou com binding Pull (CONTRACT_PULL_FORBIDDEN)
 * são recusados de imediato, sem produzir modelo (tarefas 4.2/4.3).
 */
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import type { ErrorCode, ParseError, Result } from '../errors.js';
import type { Band, BandSet, Group } from '../model/bands.js';
import type { DataContract, FieldDecl, ParamDecl, VariableCalculation, VariableDecl, VariableResetType } from '../model/contract.js';
import type { BarcodeType, Element, StaticText, SubreportParameter, TableCell, TableColumn, TextField } from '../model/elements.js';
import type { Bounds, PageFormat, Pen } from '../model/primitives.js';
import type { ReportTemplate } from '../model/report.js';
import type { ConditionalStyle, Style, StyleProps } from '../model/styles.js';
import { fieldTypeFromJavaClass, scalarTypeFromJavaClass } from './javaTypes.js';

// ---------------------------------------------------------------------------
// Infra XML

/** Tags que podem repetir e devem sempre virar array. */
const ARRAY_TAGS = new Set([
  'property',
  'style',
  'conditionalStyle',
  'parameter',
  'field',
  'variable',
  'group',
  'band',
  'element',
  'dataset',
  'column',
]);

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  alwaysCreateTextNode: true,
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  isArray: (name) => ARRAY_TAGS.has(name),
});

type XmlNode = Record<string, unknown>;

/** Contexto de parse: acumulador de erros + estado compartilhado do documento. */
interface Ctx {
  errors: ParseError[];
  /** Campos de cada `<dataset>` (subDataset) — viram `itemFields` da coleção. */
  datasets: Map<string, FieldDecl[]>;
  /** Fields do contrato, para ligar tabela → campo-coleção. */
  contractFields: FieldDecl[];
}

function err(ctx: Ctx, code: ParseError['code'], message: string, path: string): void {
  ctx.errors.push({ code, message, path });
}

// Acessores tolerantes (narrowing de `unknown`) -----------------------------

function child(node: XmlNode, tag: string): XmlNode | undefined {
  const v = node[tag];
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as XmlNode) : undefined;
}

function children(node: XmlNode, tag: string): XmlNode[] {
  const v = node[tag];
  if (Array.isArray(v)) return v as XmlNode[];
  return typeof v === 'object' && v !== null ? [v as XmlNode] : [];
}

/** Texto de um nó (`<tag>valor</tag>` ou CDATA). */
function text(node: XmlNode | undefined): string | undefined {
  if (!node) return undefined;
  const v = node['#text'];
  return typeof v === 'string' ? v : undefined;
}

function attr(node: XmlNode, name: string): string | undefined {
  const v = node[`@_${name}`];
  return typeof v === 'string' ? v : undefined;
}

function numAttr(ctx: Ctx, node: XmlNode, name: string, path: string): number | undefined {
  const raw = attr(node, name);
  if (raw === undefined) return undefined;
  const n = Number(raw);
  if (Number.isNaN(n)) {
    err(ctx, 'INVALID_ATTRIBUTE', `atributo "${name}" deve ser numérico (recebido: "${raw}")`, path);
    return undefined;
  }
  return n;
}

function boolAttr(node: XmlNode, name: string): boolean | undefined {
  const raw = attr(node, name);
  if (raw === undefined) return undefined;
  return raw === 'true';
}

/** Valida valor contra uma união fechada; erro estruturado quando inválido. */
function oneOf<T extends string>(
  ctx: Ctx,
  value: string | undefined,
  allowed: readonly T[],
  attrName: string,
  path: string,
): T | undefined {
  if (value === undefined) return undefined;
  if ((allowed as readonly string[]).includes(value)) return value as T;
  err(ctx, 'INVALID_ATTRIBUTE', `valor inválido para "${attrName}": "${value}" (esperado: ${allowed.join(' | ')})`, path);
  return undefined;
}

/** Espalha `{ [key]: value }` apenas quando definido (exactOptionalPropertyTypes). */
function opt<K extends string, V>(key: K, value: V | undefined): Partial<Record<K, V>> {
  return value === undefined ? {} : ({ [key]: value } as Record<K, V>);
}

// ---------------------------------------------------------------------------
// Gates de dialeto e anti-Pull (tarefas 4.2 e 4.3)

/**
 * Tags proibidas em qualquer profundidade do documento.
 * Pull (ADR-003, I-3) tem precedência semântica sobre legado (nota 002).
 */
const FORBIDDEN_TAGS: Record<string, { code: ErrorCode; message: string }> = {
  // Anti-Pull (4.3): as três formas de embutir fonte de dados no template.
  query: {
    code: 'CONTRACT_PULL_FORBIDDEN',
    message: '<query> embute SQL no template — ReportLenz é contract-first/Push (ADR-003): declare o contrato em <field>/<parameter>',
  },
  queryString: {
    code: 'CONTRACT_PULL_FORBIDDEN',
    message: '<queryString> embute query no template (forma 6.x) — Pull é proibido (ADR-003)',
  },
  connectionExpression: {
    code: 'CONTRACT_PULL_FORBIDDEN',
    message: '<connectionExpression> passa conexão JDBC a subreport — Pull é proibido (ADR-003); use <dataSourceExpression> sobre campo-coleção',
  },
  // Dialeto 6.x (4.2): construções que não existem no JRXML 7 (nota 002).
  reportElement: {
    code: 'LEGACY_DIALECT',
    message: '<reportElement> é o formato aninhado do JRXML 6.x — o dialeto 7 usa <element kind="..."> (ADR-002)',
  },
  reportFont: {
    code: 'LEGACY_DIALECT',
    message: '<reportFont> não existe no JRXML 7 (ADR-002)',
  },
  variableExpression: {
    code: 'LEGACY_DIALECT',
    message: '<variableExpression> é 6.x — no dialeto 7 a variável usa <expression> (ADR-002)',
  },
  groupExpression: {
    code: 'LEGACY_DIALECT',
    message: '<groupExpression> é 6.x — no dialeto 7 o grupo usa <expression> (ADR-002)',
  },
};

/** Varre o documento por marcadores 6.x e Pull; erros aqui são recusa total. */
function scanDialect(ctx: Ctx, root: XmlNode): void {
  // O dialeto 7 não usa namespace nem schemaLocation na raiz (nota 002).
  for (const key of Object.keys(root)) {
    if (key === '@_xmlns' || key.startsWith('@_xmlns:') || key === '@_xsi:schemaLocation') {
      err(
        ctx,
        'LEGACY_DIALECT',
        `raiz <jasperReport> com "${key.slice(2)}" — o dialeto JRXML 7 não usa namespace/schemaLocation (ADR-002)`,
        'jasperReport',
      );
    }
  }
  scanNode(ctx, root, 'jasperReport');
}

function scanNode(ctx: Ctx, node: XmlNode, path: string): void {
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith('@_') || key === '#text') continue;
    const forbidden = FORBIDDEN_TAGS[key];
    if (forbidden) {
      err(ctx, forbidden.code, forbidden.message, `${path}/${key}`);
      continue;
    }
    const nodes = Array.isArray(value) ? (value as XmlNode[]) : typeof value === 'object' && value !== null ? [value as XmlNode] : [];
    for (const [i, childNode] of nodes.entries()) {
      scanNode(ctx, childNode, nodes.length > 1 ? `${path}/${key}[${i}]` : `${path}/${key}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Estilo

const H_ALIGN = ['Left', 'Center', 'Right', 'Justified'] as const;
const V_ALIGN = ['Top', 'Middle', 'Bottom'] as const;
const ROTATION = ['None', 'Left', 'Right', 'UpsideDown'] as const;
const MODE = ['Opaque', 'Transparent'] as const;
const LINE_STYLE = ['Solid', 'Dashed', 'Dotted', 'Double'] as const;

/** Extrai StyleProps dos atributos de um nó (`<style>`, `<element>`, `<conditionalStyle>`). */
function parseStyleProps(ctx: Ctx, node: XmlNode, path: string): StyleProps {
  return {
    ...opt('mode', oneOf(ctx, attr(node, 'mode'), MODE, 'mode', path)),
    ...opt('forecolor', attr(node, 'forecolor')),
    ...opt('backcolor', attr(node, 'backcolor')),
    ...opt('fontName', attr(node, 'fontName')),
    ...opt('fontSize', numAttr(ctx, node, 'fontSize', path)),
    ...opt('bold', boolAttr(node, 'bold')),
    ...opt('italic', boolAttr(node, 'italic')),
    ...opt('underline', boolAttr(node, 'underline')),
    ...opt('strikeThrough', boolAttr(node, 'strikeThrough')),
    ...opt('hAlign', oneOf(ctx, attr(node, 'hTextAlign'), H_ALIGN, 'hTextAlign', path)),
    ...opt('vAlign', oneOf(ctx, attr(node, 'vTextAlign'), V_ALIGN, 'vTextAlign', path)),
    ...opt('rotation', oneOf(ctx, attr(node, 'rotation'), ROTATION, 'rotation', path)),
  };
}

function parseStyle(ctx: Ctx, node: XmlNode, path: string): Style | undefined {
  const name = attr(node, 'name');
  if (!name) {
    err(ctx, 'INVALID_ATTRIBUTE', 'estilo sem atributo "name"', path);
    return undefined;
  }
  const conditionalStyles = children(node, 'conditionalStyle').map((cs, i) =>
    parseConditionalStyle(ctx, cs, `${path}/conditionalStyle[${i}]`),
  );
  return {
    name,
    ...parseStyleProps(ctx, node, path),
    ...opt('parentStyleRef', attr(node, 'style')),
    ...opt('isDefault', boolAttr(node, 'default')),
    ...(conditionalStyles.length > 0 ? { conditionalStyles } : {}),
  };
}

function parseConditionalStyle(ctx: Ctx, node: XmlNode, path: string): ConditionalStyle {
  const conditionExpression = text(child(node, 'conditionExpression'));
  if (conditionExpression === undefined) {
    err(ctx, 'INVALID_ATTRIBUTE', 'conditionalStyle sem <conditionExpression>', path);
  }
  return { conditionExpression: conditionExpression ?? '', style: parseStyleProps(ctx, node, path) };
}

// ---------------------------------------------------------------------------
// Contrato (field/parameter/variable)

const CALCULATIONS = ['Nothing', 'Count', 'DistinctCount', 'Sum', 'Average', 'Lowest', 'Highest', 'StandardDeviation', 'Variance', 'System', 'First'] as const;
const RESET_TYPES = ['None', 'Report', 'Page', 'Column', 'Group'] as const;

function parseFieldDecl(ctx: Ctx, node: XmlNode, path: string): FieldDecl | undefined {
  const name = attr(node, 'name');
  const javaClass = attr(node, 'class');
  if (!name || !javaClass) {
    err(ctx, 'INVALID_ATTRIBUTE', 'field exige atributos "name" e "class"', path);
    return undefined;
  }
  const type = fieldTypeFromJavaClass(javaClass);
  if (!type) {
    err(ctx, 'UNSUPPORTED_TYPE', `classe Java sem mapeamento no contrato: "${javaClass}"`, path);
    return undefined;
  }
  return { name, type, ...opt('description', text(child(node, 'description'))) };
}

/** `<dataset name>`: no ReportLenz declara os campos dos ITENS de uma coleção. */
function parseDatasets(ctx: Ctx, root: XmlNode): void {
  for (const [i, node] of children(root, 'dataset').entries()) {
    const path = `jasperReport/dataset[${i}]`;
    const name = attr(node, 'name');
    if (!name) {
      err(ctx, 'INVALID_ATTRIBUTE', 'dataset sem atributo "name"', path);
      continue;
    }
    const fields: FieldDecl[] = [];
    for (const [j, f] of children(node, 'field').entries()) {
      const decl = parseFieldDecl(ctx, f, `${path}/field[${j}]`);
      if (decl) fields.push(decl);
    }
    ctx.datasets.set(name, fields);
  }
}

function parseContract(ctx: Ctx, root: XmlNode): DataContract {
  const fields: FieldDecl[] = [];
  for (const [i, node] of children(root, 'field').entries()) {
    const decl = parseFieldDecl(ctx, node, `jasperReport/field[${i}]`);
    if (decl) fields.push(decl);
  }
  ctx.contractFields = fields;

  const parameters: ParamDecl[] = [];
  for (const [i, node] of children(root, 'parameter').entries()) {
    const path = `jasperReport/parameter[${i}]`;
    const name = attr(node, 'name');
    const javaClass = attr(node, 'class');
    if (!name || !javaClass) {
      err(ctx, 'INVALID_ATTRIBUTE', 'parameter exige atributos "name" e "class"', path);
      continue;
    }
    const type = scalarTypeFromJavaClass(javaClass);
    if (!type) {
      err(ctx, 'UNSUPPORTED_TYPE', `classe Java sem mapeamento no contrato: "${javaClass}"`, path);
      continue;
    }
    parameters.push({
      name,
      type,
      ...opt('description', text(child(node, 'description'))),
      ...opt('defaultValueExpression', text(child(node, 'defaultValueExpression'))),
    });
  }

  const variables: VariableDecl[] = [];
  for (const [i, node] of children(root, 'variable').entries()) {
    const path = `jasperReport/variable[${i}]`;
    const name = attr(node, 'name');
    const javaClass = attr(node, 'class');
    if (!name || !javaClass) {
      err(ctx, 'INVALID_ATTRIBUTE', 'variable exige atributos "name" e "class"', path);
      continue;
    }
    const type = scalarTypeFromJavaClass(javaClass);
    if (!type) {
      err(ctx, 'UNSUPPORTED_TYPE', `classe Java sem mapeamento no contrato: "${javaClass}"`, path);
      continue;
    }
    const calculation: VariableCalculation =
      oneOf(ctx, attr(node, 'calculation'), CALCULATIONS, 'calculation', path) ?? 'Nothing';
    const resetType: VariableResetType | undefined = oneOf(ctx, attr(node, 'resetType'), RESET_TYPES, 'resetType', path);
    variables.push({
      name,
      type,
      calculation,
      ...opt('expression', text(child(node, 'expression'))),
      ...opt('resetType', resetType),
      ...opt('resetGroup', attr(node, 'resetGroup')),
      ...opt('initialValueExpression', text(child(node, 'initialValueExpression'))),
    });
  }

  return { fields, parameters, variables };
}

// ---------------------------------------------------------------------------
// Elementos

function parseBounds(ctx: Ctx, node: XmlNode, path: string): Bounds {
  const bounds: Bounds = { x: 0, y: 0, width: 0, height: 0 };
  for (const dim of ['x', 'y', 'width', 'height'] as const) {
    const v = numAttr(ctx, node, dim, path);
    if (v === undefined) {
      err(ctx, 'INVALID_ATTRIBUTE', `elemento sem atributo obrigatório "${dim}"`, path);
    } else {
      bounds[dim] = v;
    }
  }
  return bounds;
}

function parsePen(ctx: Ctx, node: XmlNode | undefined, path: string): Pen | undefined {
  if (!node) return undefined;
  const pen: Pen = {
    ...opt('lineWidth', numAttr(ctx, node, 'lineWidth', path)),
    ...opt('lineStyle', oneOf(ctx, attr(node, 'lineStyle'), LINE_STYLE, 'lineStyle', path)),
    ...opt('lineColor', attr(node, 'lineColor')),
  };
  return Object.keys(pen).length > 0 ? pen : undefined;
}

/** Base comum: bounds + styleRef + sobrescritas locais + printWhen. */
function parseElementBase(ctx: Ctx, node: XmlNode, path: string) {
  const style = parseStyleProps(ctx, node, path);
  return {
    ...opt('key', attr(node, 'key')),
    bounds: parseBounds(ctx, node, path),
    ...opt('styleRef', attr(node, 'style')),
    ...(Object.keys(style).length > 0 ? { style } : {}),
    ...opt('printWhenExpression', text(child(node, 'printWhenExpression'))),
  };
}

function parseElement(ctx: Ctx, node: XmlNode, path: string): Element | undefined {
  const kind = attr(node, 'kind');
  switch (kind) {
    case 'staticText': {
      const st: StaticText = { kind: 'staticText', ...parseElementBase(ctx, node, path), text: text(child(node, 'text')) ?? '' };
      return st;
    }
    case 'textField': {
      const expression = text(child(node, 'expression'));
      if (expression === undefined) {
        err(ctx, 'INVALID_ATTRIBUTE', 'textField sem <expression>', path);
      }
      const tf: TextField = {
        kind: 'textField',
        ...parseElementBase(ctx, node, path),
        expression: expression ?? '',
        ...opt('pattern', attr(node, 'pattern')),
        ...opt('blankWhenNull', boolAttr(node, 'blankWhenNull')),
        ...opt('textAdjust', oneOf(ctx, attr(node, 'textAdjust'), ['CutText', 'StretchHeight', 'ScaleFont'] as const, 'textAdjust', path)),
      };
      return tf;
    }
    case 'line':
      return {
        kind: 'line',
        ...parseElementBase(ctx, node, path),
        ...opt('direction', oneOf(ctx, attr(node, 'direction'), ['TopDown', 'BottomUp'] as const, 'direction', path)),
        ...opt('pen', parsePen(ctx, child(node, 'pen'), `${path}/pen`)),
      };
    case 'rectangle':
      return {
        kind: 'rectangle',
        ...parseElementBase(ctx, node, path),
        ...opt('radius', numAttr(ctx, node, 'radius', path)),
        ...opt('pen', parsePen(ctx, child(node, 'pen'), `${path}/pen`)),
      };
    case 'ellipse':
      return {
        kind: 'ellipse',
        ...parseElementBase(ctx, node, path),
        ...opt('pen', parsePen(ctx, child(node, 'pen'), `${path}/pen`)),
      };
    case 'image': {
      const expression = text(child(node, 'expression'));
      if (expression === undefined) {
        err(ctx, 'INVALID_ATTRIBUTE', 'image sem <expression>', path);
      }
      return {
        kind: 'image',
        ...parseElementBase(ctx, node, path),
        expression: expression ?? '',
        ...opt('scaleImage', oneOf(ctx, attr(node, 'scaleImage'), ['Clip', 'FillFrame', 'RetainShape', 'RealHeight', 'RealSize'] as const, 'scaleImage', path)),
        ...opt('onErrorType', oneOf(ctx, attr(node, 'onErrorType'), ['Error', 'Blank', 'Icon'] as const, 'onErrorType', path)),
      };
    }
    case 'frame':
      return {
        kind: 'frame',
        ...parseElementBase(ctx, node, path),
        elements: parseElements(ctx, node, path),
      };
    case 'component':
      return parseComponent(ctx, node, path);
    case 'subreport':
      return parseSubreport(ctx, node, path);
    case undefined:
      err(ctx, 'INVALID_ATTRIBUTE', 'elemento sem atributo "kind"', path);
      return undefined;
    default:
      err(ctx, 'UNSUPPORTED_ELEMENT', `kind de elemento fora do subconjunto suportado: "${kind}"`, path);
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// Componentes (table, barcode) e subreport — tarefa 4.1c

/** Kinds barcode4j do dialeto 7 → subconjunto BarcodeType do modelo. */
const BARCODE_KINDS: Record<string, BarcodeType> = {
  'barcode4j:Code128': 'Code128',
  'barcode4j:Code39': 'Code39',
  'barcode4j:EAN13': 'EAN13',
  'barcode4j:EAN8': 'EAN8',
  'barcode4j:Interleaved2Of5': 'Interleaved2Of5',
  'barcode4j:QRCode': 'QRCode',
  'barcode4j:DataMatrix': 'DataMatrix',
  'barcode4j:PDF417': 'PDF417',
};

function parseComponent(ctx: Ctx, node: XmlNode, path: string): Element | undefined {
  const component = child(node, 'component');
  const componentKind = component ? attr(component, 'kind') : undefined;
  if (!component || !componentKind) {
    err(ctx, 'INVALID_ATTRIBUTE', 'element kind="component" sem <component kind="...">', path);
    return undefined;
  }

  const barcodeType = BARCODE_KINDS[componentKind];
  if (barcodeType) {
    const expression = text(child(component, 'codeExpression'));
    if (expression === undefined) {
      err(ctx, 'INVALID_ATTRIBUTE', `barcode sem <codeExpression>`, `${path}/component`);
    }
    return { kind: 'barcode', ...parseElementBase(ctx, node, path), barcodeType, expression: expression ?? '' };
  }

  if (componentKind === 'table') return parseTable(ctx, node, component, path);

  err(ctx, 'UNSUPPORTED_ELEMENT', `component fora do subconjunto suportado: "${componentKind}"`, `${path}/component`);
  return undefined;
}

/**
 * Tabela em modo Push (ADR-003): o `<dataSourceExpression>` do datasetRun
 * DEVE referenciar um campo-coleção do contrato (`$F{...}`); os campos do
 * `<dataset>` referenciado viram `itemFields` desse campo.
 */
function parseTable(ctx: Ctx, node: XmlNode, component: XmlNode, path: string): Element | undefined {
  const componentPath = `${path}/component`;
  const datasetRun = child(component, 'datasetRun');
  if (!datasetRun) {
    err(ctx, 'INVALID_ATTRIBUTE', 'tabela sem <datasetRun>', componentPath);
    return undefined;
  }

  const dataSourceExpression = text(child(datasetRun, 'dataSourceExpression'));
  const fieldRef = dataSourceExpression ? /\$F\{([^}]+)\}/.exec(dataSourceExpression) : null;
  if (!fieldRef?.[1]) {
    err(
      ctx,
      'INVALID_ATTRIBUTE',
      'tabela deve ser alimentada por campo-coleção do contrato via $F{...} no <dataSourceExpression> (Push, ADR-003)',
      `${componentPath}/datasetRun`,
    );
    return undefined;
  }
  const datasetField = fieldRef[1];

  // Liga os campos do subDataset como itemFields do campo-coleção do contrato.
  const subDataset = attr(datasetRun, 'subDataset');
  const contractField = ctx.contractFields.find((f) => f.name === datasetField);
  if (subDataset !== undefined) {
    const datasetFields = ctx.datasets.get(subDataset);
    if (!datasetFields) {
      err(ctx, 'INVALID_ATTRIBUTE', `datasetRun referencia dataset inexistente: "${subDataset}"`, `${componentPath}/datasetRun`);
    } else if (contractField && contractField.type === 'collection' && datasetFields.length > 0) {
      contractField.itemFields = datasetFields;
    }
  }

  const columns: TableColumn[] = [];
  for (const [i, col] of children(component, 'column').entries()) {
    const colPath = `${componentPath}/column[${i}]`;
    const colKind = attr(col, 'kind');
    if (colKind !== 'single') {
      err(ctx, 'UNSUPPORTED_ELEMENT', `coluna de tabela com kind "${colKind ?? '(ausente)'}" não suportada (apenas "single"; grupos de coluna chegam na Fase 3)`, colPath);
      continue;
    }
    const width = numAttr(ctx, col, 'width', colPath);
    if (width === undefined) {
      err(ctx, 'INVALID_ATTRIBUTE', 'coluna de tabela sem atributo "width"', colPath);
      continue;
    }
    const detailCell = child(col, 'detailCell');
    if (!detailCell) {
      err(ctx, 'INVALID_ATTRIBUTE', 'coluna de tabela sem <detailCell>', colPath);
      continue;
    }
    const headerCell = child(col, 'columnHeader');
    const footerCell = child(col, 'columnFooter');
    columns.push({
      width,
      ...opt('header', headerCell ? parseTableCell(ctx, headerCell, `${colPath}/columnHeader`) : undefined),
      detail: parseTableCell(ctx, detailCell, `${colPath}/detailCell`),
      ...opt('footer', footerCell ? parseTableCell(ctx, footerCell, `${colPath}/columnFooter`) : undefined),
    });
  }

  return { kind: 'table', ...parseElementBase(ctx, node, path), datasetField, columns };
}

function parseTableCell(ctx: Ctx, node: XmlNode, path: string): TableCell {
  const height = numAttr(ctx, node, 'height', path);
  if (height === undefined) {
    err(ctx, 'INVALID_ATTRIBUTE', 'célula de tabela sem atributo "height"', path);
  }
  return {
    height: height ?? 0,
    ...opt('styleRef', attr(node, 'style')),
    elements: parseElements(ctx, node, path),
  };
}

/**
 * Subreport em modo Push: template + datasource por expressão. O
 * `<connectionExpression>` (JDBC) é Pull e já foi recusado pelo scanDialect.
 */
function parseSubreport(ctx: Ctx, node: XmlNode, path: string): Element | undefined {
  const templateExpression = text(child(node, 'expression'));
  if (templateExpression === undefined) {
    err(ctx, 'INVALID_ATTRIBUTE', 'subreport sem <expression> (template)', path);
  }
  if (child(node, 'returnValue')) {
    err(ctx, 'UNSUPPORTED_ELEMENT', 'subreport com <returnValue> não é suportado no subconjunto atual', path);
  }
  const parameters: SubreportParameter[] = [];
  for (const [i, p] of children(node, 'parameter').entries()) {
    const pPath = `${path}/parameter[${i}]`;
    const name = attr(p, 'name');
    const expression = text(child(p, 'expression'));
    if (!name || expression === undefined) {
      err(ctx, 'INVALID_ATTRIBUTE', 'parameter de subreport exige "name" e <expression>', pPath);
      continue;
    }
    parameters.push({ name, expression });
  }
  return {
    kind: 'subreport',
    ...parseElementBase(ctx, node, path),
    templateExpression: templateExpression ?? '',
    ...opt('dataSourceExpression', text(child(node, 'dataSourceExpression'))),
    parameters,
  };
}

function parseElements(ctx: Ctx, parent: XmlNode, parentPath: string): Element[] {
  const out: Element[] = [];
  for (const [i, node] of children(parent, 'element').entries()) {
    const el = parseElement(ctx, node, `${parentPath}/element[${i}]`);
    if (el) out.push(el);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Bandas, seções e grupos

const SPLIT_TYPES = ['Stretch', 'Prevent', 'Immediate'] as const;

function parseBand(ctx: Ctx, node: XmlNode, path: string): Band {
  const height = numAttr(ctx, node, 'height', path);
  if (height === undefined) {
    err(ctx, 'INVALID_ATTRIBUTE', 'band sem atributo obrigatório "height"', path);
  }
  return {
    height: height ?? 0,
    splitType: oneOf(ctx, attr(node, 'splitType'), SPLIT_TYPES, 'splitType', path) ?? 'Stretch',
    elements: parseElements(ctx, node, path),
    ...opt('printWhenExpression', text(child(node, 'printWhenExpression'))),
  };
}

/**
 * Seção de banda única (`<title>`, `<pageHeader>`, ...). No dialeto 7 a seção
 * É a banda: height/splitType ficam direto na tag (`<title height="60">`);
 * `<band>` aninhado aqui é rejeitado pela Library (verificado pelo harness).
 */
function parseSingleBandSection(ctx: Ctx, root: XmlNode, tag: string): Band | undefined {
  const section = child(root, tag);
  if (!section) return undefined;
  const path = `jasperReport/${tag}`;
  if (children(section, 'band').length > 0) {
    err(ctx, 'INVALID_ATTRIBUTE', `<${tag}> não aceita <band> aninhado no dialeto 7 — os atributos da banda vão direto na seção`, path);
    return undefined;
  }
  return parseBand(ctx, section, path);
}

function parseGroups(ctx: Ctx, root: XmlNode): Group[] {
  const out: Group[] = [];
  for (const [i, node] of children(root, 'group').entries()) {
    const path = `jasperReport/group[${i}]`;
    const name = attr(node, 'name');
    if (!name) {
      err(ctx, 'INVALID_ATTRIBUTE', 'group sem atributo "name"', path);
      continue;
    }
    const expression = text(child(node, 'expression'));
    if (expression === undefined) {
      err(ctx, 'INVALID_ATTRIBUTE', 'group sem <expression>', path);
    }
    const headerSection = child(node, 'groupHeader');
    const footerSection = child(node, 'groupFooter');
    const headerBand = headerSection ? children(headerSection, 'band')[0] : undefined;
    const footerBand = footerSection ? children(footerSection, 'band')[0] : undefined;
    out.push({
      name,
      expression: expression ?? '',
      ...opt('header', headerBand ? parseBand(ctx, headerBand, `${path}/groupHeader/band[0]`) : undefined),
      ...opt('footer', footerBand ? parseBand(ctx, footerBand, `${path}/groupFooter/band[0]`) : undefined),
      ...opt('startNewPage', boolAttr(node, 'startNewPage')),
    });
  }
  return out;
}

function parseBandSet(ctx: Ctx, root: XmlNode): BandSet {
  const detailSection = child(root, 'detail');
  const detail = detailSection
    ? children(detailSection, 'band').map((b, i) => parseBand(ctx, b, `jasperReport/detail/band[${i}]`))
    : [];
  return {
    ...opt('title', parseSingleBandSection(ctx, root, 'title')),
    ...opt('background', parseSingleBandSection(ctx, root, 'background')),
    ...opt('pageHeader', parseSingleBandSection(ctx, root, 'pageHeader')),
    ...opt('columnHeader', parseSingleBandSection(ctx, root, 'columnHeader')),
    detail,
    ...opt('columnFooter', parseSingleBandSection(ctx, root, 'columnFooter')),
    ...opt('pageFooter', parseSingleBandSection(ctx, root, 'pageFooter')),
    ...opt('summary', parseSingleBandSection(ctx, root, 'summary')),
    ...opt('noData', parseSingleBandSection(ctx, root, 'noData')),
    groups: parseGroups(ctx, root),
  };
}

// ---------------------------------------------------------------------------
// Raiz

/** Defaults do engine JasperReports para a página. */
function parsePageFormat(ctx: Ctx, root: XmlNode): PageFormat {
  const path = 'jasperReport';
  return {
    pageWidth: numAttr(ctx, root, 'pageWidth', path) ?? 595,
    pageHeight: numAttr(ctx, root, 'pageHeight', path) ?? 842,
    orientation: oneOf(ctx, attr(root, 'orientation'), ['Portrait', 'Landscape'] as const, 'orientation', path) ?? 'Portrait',
    leftMargin: numAttr(ctx, root, 'leftMargin', path) ?? 20,
    rightMargin: numAttr(ctx, root, 'rightMargin', path) ?? 20,
    topMargin: numAttr(ctx, root, 'topMargin', path) ?? 30,
    bottomMargin: numAttr(ctx, root, 'bottomMargin', path) ?? 30,
    columnCount: numAttr(ctx, root, 'columnCount', path) ?? 1,
    columnWidth: numAttr(ctx, root, 'columnWidth', path) ?? 555,
    columnSpacing: numAttr(ctx, root, 'columnSpacing', path) ?? 0,
  };
}

function parseProperties(root: XmlNode): Record<string, string> {
  const out: Record<string, string> = {};
  for (const node of children(root, 'property')) {
    const name = attr(node, 'name');
    const value = attr(node, 'value');
    if (name !== undefined && value !== undefined) out[name] = value;
  }
  return out;
}

/**
 * Converte um documento JRXML 7 em `ReportTemplate` (RFC-001 §4).
 * Falha com a lista completa de erros estruturados encontrados.
 */
export function parseJrxml(xml: string): Result<ReportTemplate, ParseError[]> {
  const ctx: Ctx = { errors: [], datasets: new Map(), contractFields: [] };

  const wellFormed = XMLValidator.validate(xml);
  if (wellFormed !== true) {
    return {
      ok: false,
      errors: [
        {
          code: 'XML_MALFORMED',
          message: `XML mal-formado: ${wellFormed.err.msg}`,
          path: '',
          line: wellFormed.err.line,
          column: wellFormed.err.col,
        },
      ],
    };
  }

  const doc = xmlParser.parse(xml) as XmlNode;
  const root = child(doc, 'jasperReport');
  if (!root) {
    return {
      ok: false,
      errors: [{ code: 'XML_MALFORMED', message: 'documento não é um JRXML: raiz <jasperReport> ausente', path: '' }],
    };
  }

  // Gates decisivos (4.2/4.3): dialeto 6.x ou Pull → recusa sem produzir modelo.
  scanDialect(ctx, root);
  if (ctx.errors.length > 0) return { ok: false, errors: ctx.errors };

  const name = attr(root, 'name');
  if (!name) {
    err(ctx, 'INVALID_ATTRIBUTE', 'jasperReport sem atributo obrigatório "name"', 'jasperReport');
  }

  const styles: Style[] = [];
  for (const [i, node] of children(root, 'style').entries()) {
    const style = parseStyle(ctx, node, `jasperReport/style[${i}]`);
    if (style) styles.push(style);
  }

  // Datasets antes do contrato/bandas: tabelas ligam itemFields via datasetRun.
  parseDatasets(ctx, root);

  const template: ReportTemplate = {
    name: name ?? '',
    pageFormat: parsePageFormat(ctx, root),
    properties: parseProperties(root),
    styles,
    dataContract: parseContract(ctx, root),
    bands: parseBandSet(ctx, root),
  };

  if (ctx.errors.length > 0) return { ok: false, errors: ctx.errors };
  return { ok: true, value: template };
}
