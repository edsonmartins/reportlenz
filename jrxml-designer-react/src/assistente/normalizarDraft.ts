/**
 * Normalização do draft gerado pela IA (Fase 4, RFC-005 §2 — espelho do
 * `normalizeGeneratedWorkflow` do mentors-ipaas-admin): o JSON do modelo é
 * plausível mas não confiável — aqui ele vira um `ReportTemplate` com TODAS
 * as chaves estruturais presentes, ANTES da validação obrigatória
 * (validateSchema + validateContract) e de chegar ao canvas.
 */
import type { DataContract, PageFormat, ReportTemplate } from '@reportlenz/jrxml-core';

const A4: PageFormat = {
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
};

const eObjeto = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const numero = (v: unknown, padrao: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : padrao;

function normalizarPagina(bruto: unknown): PageFormat {
  if (!eObjeto(bruto)) return { ...A4 };
  const pf: PageFormat = {
    pageWidth: numero(bruto.pageWidth, A4.pageWidth),
    pageHeight: numero(bruto.pageHeight, A4.pageHeight),
    orientation: bruto.orientation === 'Landscape' ? 'Landscape' : 'Portrait',
    leftMargin: numero(bruto.leftMargin, A4.leftMargin),
    rightMargin: numero(bruto.rightMargin, A4.rightMargin),
    topMargin: numero(bruto.topMargin, A4.topMargin),
    bottomMargin: numero(bruto.bottomMargin, A4.bottomMargin),
    columnCount: Math.max(1, numero(bruto.columnCount, 1)),
    columnSpacing: numero(bruto.columnSpacing, 0),
    columnWidth: numero(bruto.columnWidth, 0),
  };
  if (pf.columnWidth <= 0) {
    const util = pf.pageWidth - pf.leftMargin - pf.rightMargin;
    pf.columnWidth = Math.floor((util - (pf.columnCount - 1) * pf.columnSpacing) / pf.columnCount);
  }
  if (bruto.printOrder === 'Horizontal') pf.printOrder = 'Horizontal';
  return pf;
}

function normalizarContrato(bruto: unknown): DataContract {
  const c = eObjeto(bruto) ? bruto : {};
  return {
    fields: Array.isArray(c.fields) ? (c.fields as DataContract['fields']) : [],
    parameters: Array.isArray(c.parameters) ? (c.parameters as DataContract['parameters']) : [],
    variables: Array.isArray(c.variables) ? (c.variables as DataContract['variables']) : [],
  };
}

/**
 * Garante a forma estrutural do template. Elementos/bandas malformados NÃO são
 * "consertados" aqui — a validação contínua acusa (o serializer recusa kind
 * desconhecido); consertar em silêncio esconderia o erro da IA do usuário.
 */
export function normalizarDraft(bruto: unknown): ReportTemplate {
  if (!eObjeto(bruto)) {
    throw new Error('draft da IA não é um objeto — nada a carregar');
  }
  const bands = eObjeto(bruto.bands) ? bruto.bands : {};
  return {
    name: typeof bruto.name === 'string' && bruto.name.trim() ? bruto.name.trim() : 'relatorio_ia',
    pageFormat: normalizarPagina(bruto.pageFormat),
    properties: eObjeto(bruto.properties) ? (bruto.properties as Record<string, string>) : {},
    styles: Array.isArray(bruto.styles) ? (bruto.styles as ReportTemplate['styles']) : [],
    dataContract: normalizarContrato(bruto.dataContract),
    bands: {
      ...(bands as unknown as ReportTemplate['bands']),
      detail: Array.isArray(bands.detail) ? (bands.detail as ReportTemplate['bands']['detail']) : [],
      groups: Array.isArray(bands.groups) ? (bands.groups as ReportTemplate['bands']['groups']) : [],
    },
  };
}
