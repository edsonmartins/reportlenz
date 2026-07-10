/**
 * `validateContract` (tarefa phase-0/6.2, gate G3): integridade de expressões
 * contra o contrato de dados — toda `$F{x}`/`$P{x}`/`$V{x}` deve referenciar
 * declaração existente no escopo em que a expressão avalia.
 *
 * Escopos:
 * - master: fields/parameters/variables do contrato + built-ins do engine +
 *   variáveis de grupo (`{grupo}_COUNT`);
 * - célula de tabela: itemFields do campo-coleção + built-ins (o subdataset
 *   emitido não declara parâmetros/variáveis próprios).
 *
 * Anti-Pull (G2): no nível do MODELO a garantia é por construção — não existe
 * campo para query/conexão em `ReportTemplate`. A recusa de `<query>`/
 * `<queryString>`/`<connectionExpression>` em XML acontece no parse
 * (`CONTRACT_PULL_FORBIDDEN`), coberto por `validateSchema`.
 *
 * Caminhos das mensagens são em espaço de MODELO (`bands/detail[0]/elements[1]`)
 * — é o que o ReportChecker da UI navega.
 */
import type { ParseError, ValidationResult } from '../errors.js';
import type { Band } from '../model/bands.js';
import type { FieldDecl } from '../model/contract.js';
import type { Element, TableCell } from '../model/elements.js';
import type { ReportTemplate } from '../model/report.js';

/** Parâmetros built-in do engine JasperReports (sempre disponíveis). */
export const BUILTIN_PARAMETERS: ReadonlySet<string> = new Set([
  'REPORT_PARAMETERS_MAP',
  'REPORT_CONTEXT',
  'REPORT_LOCALE',
  'REPORT_RESOURCE_BUNDLE',
  'REPORT_TIME_ZONE',
  'REPORT_FORMAT_FACTORY',
  'REPORT_CLASS_LOADER',
  'REPORT_DATA_SOURCE',
  'REPORT_SCRIPTLET',
  'REPORT_TEMPLATES',
  'SORT_FIELDS',
  'FILTER',
  'REPORT_VIRTUALIZER',
  'IS_IGNORE_PAGINATION',
]);

/** Variáveis built-in do engine. */
export const BUILTIN_VARIABLES: ReadonlySet<string> = new Set([
  'PAGE_NUMBER',
  'MASTER_CURRENT_PAGE',
  'MASTER_TOTAL_PAGES',
  'COLUMN_NUMBER',
  'REPORT_COUNT',
  'PAGE_COUNT',
  'COLUMN_COUNT',
]);

interface Scope {
  fields: ReadonlySet<string>;
  parameters: ReadonlySet<string>;
  variables: ReadonlySet<string>;
}

const REF_RE = /\$([FPV])\{([^}]+)\}/g;

interface Ctx {
  messages: ParseError[];
  styleNames: ReadonlySet<string>;
  master: Scope;
  /** Declarações completas dos fields (para checar tipo collection da tabela). */
  contractFields: readonly FieldDecl[];
}

function report(ctx: Ctx, code: ParseError['code'], message: string, path: string): void {
  ctx.messages.push({ code, message, path });
}

/** Verifica toda referência `$F/$P/$V` de uma expressão contra o escopo. */
function checkExpr(ctx: Ctx, expression: string | undefined, scope: Scope, path: string): void {
  if (expression === undefined) return;
  for (const m of expression.matchAll(REF_RE)) {
    const kind = m[1] as 'F' | 'P' | 'V';
    const name = m[2] as string;
    const known = kind === 'F' ? scope.fields : kind === 'P' ? scope.parameters : scope.variables;
    if (!known.has(name)) {
      const tipo = kind === 'F' ? 'field' : kind === 'P' ? 'parameter' : 'variable';
      report(ctx, 'EXPR_UNKNOWN_REF', `expressão referencia $${kind}{${name}}, mas não há ${tipo} "${name}" declarado no contrato deste escopo`, path);
    }
  }
}

function checkStyleRef(ctx: Ctx, styleRef: string | undefined, path: string): void {
  if (styleRef !== undefined && !ctx.styleNames.has(styleRef)) {
    report(ctx, 'INVALID_ATTRIBUTE', `referência a estilo inexistente: "${styleRef}"`, path);
  }
}

function checkTableCell(ctx: Ctx, cell: TableCell, itemScope: Scope, path: string): void {
  checkStyleRef(ctx, cell.styleRef, path);
  cell.elements.forEach((el, i) => checkElement(ctx, el, itemScope, `${path}/elements[${i}]`));
}

function checkElement(ctx: Ctx, el: Element, scope: Scope, path: string): void {
  checkStyleRef(ctx, el.styleRef, path);
  checkExpr(ctx, el.printWhenExpression, scope, path);

  switch (el.kind) {
    case 'staticText':
    case 'line':
    case 'rectangle':
    case 'ellipse':
      return;
    case 'textField':
      checkExpr(ctx, el.expression, scope, path);
      el.conditionalStyles?.forEach((cs, i) => checkExpr(ctx, cs.conditionExpression, scope, `${path}/conditionalStyles[${i}]`));
      return;
    case 'image':
    case 'barcode':
      checkExpr(ctx, el.expression, scope, path);
      return;
    case 'frame':
      el.elements.forEach((inner, i) => checkElement(ctx, inner, scope, `${path}/elements[${i}]`));
      return;
    case 'subreport':
      checkExpr(ctx, el.templateExpression, scope, path);
      checkExpr(ctx, el.dataSourceExpression, scope, path);
      el.parameters.forEach((p, i) => checkExpr(ctx, p.expression, scope, `${path}/parameters[${i}]`));
      return;
    case 'table': {
      // Push (ADR-003): a tabela é alimentada por campo-coleção do contrato.
      const decl = ctx.contractFields.find((f) => f.name === el.datasetField);
      if (!decl) {
        report(ctx, 'EXPR_UNKNOWN_REF', `tabela referencia campo-coleção $F{${el.datasetField}} não declarado no contrato`, path);
      } else if (decl.type !== 'collection') {
        report(ctx, 'INVALID_ATTRIBUTE', `tabela exige campo do tipo collection; "${el.datasetField}" é "${decl.type}"`, path);
      }
      const itemScope: Scope = {
        fields: new Set((decl?.type === 'collection' ? decl.itemFields ?? [] : []).map((f) => f.name)),
        parameters: BUILTIN_PARAMETERS,
        variables: BUILTIN_VARIABLES,
      };
      el.columns.forEach((col, i) => {
        const colPath = `${path}/columns[${i}]`;
        if (col.header) checkTableCell(ctx, col.header, itemScope, `${colPath}/header`);
        checkTableCell(ctx, col.detail, itemScope, `${colPath}/detail`);
        if (col.footer) checkTableCell(ctx, col.footer, itemScope, `${colPath}/footer`);
      });
      return;
    }
  }
}

function checkBand(ctx: Ctx, band: Band | undefined, path: string): void {
  if (!band) return;
  checkExpr(ctx, band.printWhenExpression, ctx.master, path);
  band.elements.forEach((el, i) => checkElement(ctx, el, ctx.master, `${path}/elements[${i}]`));
}

/**
 * Valida a integridade contrato × expressões de um template (RFC-001 §6.3).
 */
export function validateContract(t: ReportTemplate): ValidationResult {
  const groupNames = new Set(t.bands.groups.map((g) => g.name));
  const ctx: Ctx = {
    messages: [],
    styleNames: new Set(t.styles.map((s) => s.name)),
    contractFields: t.dataContract.fields,
    master: {
      fields: new Set(t.dataContract.fields.map((f) => f.name)),
      parameters: new Set([...t.dataContract.parameters.map((p) => p.name), ...BUILTIN_PARAMETERS]),
      variables: new Set([
        ...t.dataContract.variables.map((v) => v.name),
        ...BUILTIN_VARIABLES,
        ...t.bands.groups.map((g) => `${g.name}_COUNT`),
      ]),
    },
  };

  // Contrato: expressões de variáveis e defaults de parâmetros (escopo master).
  t.dataContract.variables.forEach((v, i) => {
    const path = `dataContract/variables[${i}]`;
    checkExpr(ctx, v.expression, ctx.master, path);
    checkExpr(ctx, v.initialValueExpression, ctx.master, path);
    if (v.resetType === 'Group') {
      if (v.resetGroup === undefined) {
        report(ctx, 'INVALID_ATTRIBUTE', `variável "${v.name}" com resetType Group exige resetGroup`, path);
      } else if (!groupNames.has(v.resetGroup)) {
        report(ctx, 'INVALID_ATTRIBUTE', `variável "${v.name}" referencia grupo inexistente: "${v.resetGroup}"`, path);
      }
    }
  });
  t.dataContract.parameters.forEach((p, i) => {
    checkExpr(ctx, p.defaultValueExpression, ctx.master, `dataContract/parameters[${i}]`);
  });

  // Estilos: herança e expressões condicionais.
  t.styles.forEach((s, i) => {
    const path = `styles[${i}]`;
    if (s.parentStyleRef !== undefined && !ctx.styleNames.has(s.parentStyleRef)) {
      report(ctx, 'INVALID_ATTRIBUTE', `estilo "${s.name}" herda de estilo inexistente: "${s.parentStyleRef}"`, path);
    }
    s.conditionalStyles?.forEach((cs, j) => checkExpr(ctx, cs.conditionExpression, ctx.master, `${path}/conditionalStyles[${j}]`));
  });

  // Bandas e grupos.
  const b = t.bands;
  checkBand(ctx, b.background, 'bands/background');
  checkBand(ctx, b.title, 'bands/title');
  checkBand(ctx, b.pageHeader, 'bands/pageHeader');
  checkBand(ctx, b.columnHeader, 'bands/columnHeader');
  b.detail.forEach((band, i) => checkBand(ctx, band, `bands/detail[${i}]`));
  checkBand(ctx, b.columnFooter, 'bands/columnFooter');
  checkBand(ctx, b.pageFooter, 'bands/pageFooter');
  checkBand(ctx, b.summary, 'bands/summary');
  checkBand(ctx, b.noData, 'bands/noData');
  b.groups.forEach((g, i) => {
    const path = `bands/groups[${i}]`;
    checkExpr(ctx, g.expression, ctx.master, path);
    checkBand(ctx, g.header, `${path}/header`);
    checkBand(ctx, g.footer, `${path}/footer`);
  });

  return { valid: ctx.messages.length === 0, messages: ctx.messages };
}
