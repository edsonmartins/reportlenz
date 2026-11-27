/**
 * Modelos gerenciais (ADR-022, tarefa variacoes-de-templates/2.2).
 *
 * Ambos usam a grade multi-registro (ADR-015): a coleção do payload alimenta
 * o datasource-MESTRE (uma linha por item), o que libera grupos, variáveis
 * acumuladas e cabeçalho de coluna repetido em cada folha. Dados de cabeçalho
 * chegam como PARÂMETROS (com o mestre sendo a coleção, campos escalares do
 * payload não fazem parte das linhas).
 */
import type { ReportTemplate } from '../model/report.js';
import { DIREITA, NEGRITO, a4Paisagem, a4Retrato, campo, texto } from './comum.js';

const MOEDA = '¤ #,##0.00';
const DATA = 'dd/MM/yyyy';
const CABECALHO_DE_COLUNA = { mode: 'Opaque', backcolor: '#DDE3EA', bold: true } as const;

/**
 * Listagem de vendas em A4 PAISAGEM: grupo por vendedor com subtotal, total
 * geral, zebra condicional e cabeçalho de coluna repetido em cada folha.
 * O payload chega ORDENADO por vendedor (o agrupamento é por quebra).
 */
export const REFERENCIA_LISTAGEM_VENDAS: ReportTemplate = {
  name: 'listagem_vendas',
  pageFormat: a4Paisagem(),
  properties: {
    'reportlenz.datasource.campo': 'vendas',
    'reportlenz.template.tipo': 'listagem',
  },
  styles: [
    { name: 'base', isDefault: true, fontName: 'DejaVu Sans', fontSize: 8 },
    {
      name: 'linha_zebrada',
      parentStyleRef: 'base',
      mode: 'Transparent',
      conditionalStyles: [
        { conditionExpression: '$V{REPORT_COUNT} % 2 == 0', style: { mode: 'Opaque', backcolor: '#F3F5F7' } },
      ],
    },
  ],
  dataContract: {
    fields: [
      {
        name: 'vendas',
        type: 'collection',
        itemFields: [
          { name: 'vendedor', type: 'string' },
          { name: 'data', type: 'date' },
          { name: 'cliente', type: 'string' },
          { name: 'produto', type: 'string' },
          { name: 'quantidade', type: 'decimal' },
          { name: 'valor', type: 'decimal' },
        ],
      },
    ],
    parameters: [
      { name: 'empresa', type: 'string', defaultValueExpression: '"Relatório de vendas"' },
      { name: 'periodo', type: 'string' },
    ],
    variables: [
      { name: 'subtotal_vendedor', type: 'decimal', calculation: 'Sum', expression: '$F{valor}', resetType: 'Group', resetGroup: 'por_vendedor' },
      { name: 'vendas_vendedor', type: 'integer', calculation: 'Count', expression: '$F{valor}', resetType: 'Group', resetGroup: 'por_vendedor' },
      { name: 'total_geral', type: 'decimal', calculation: 'Sum', expression: '$F{valor}', resetType: 'Report' },
      { name: 'total_vendas', type: 'integer', calculation: 'Count', expression: '$F{valor}', resetType: 'Report' },
    ],
  },
  bands: {
    title: {
      height: 40,
      splitType: 'Stretch',
      elements: [
        campo(0, 0, 500, 20, '$P{empresa}', { style: { bold: true, fontSize: 14 } }),
        texto(0, 22, 500, 14, 'Vendas por vendedor', { style: { fontSize: 10 } }),
        campo(500, 4, 302, 14, '$P{periodo} == null ? "" : "Período: " + $P{periodo}', { style: DIREITA }),
      ],
    },
    columnHeader: {
      height: 18,
      splitType: 'Stretch',
      elements: [
        texto(0, 0, 70, 18, 'Data', { style: { ...CABECALHO_DE_COLUNA, vAlign: 'Middle' } }),
        texto(70, 0, 230, 18, 'Cliente', { style: { ...CABECALHO_DE_COLUNA, vAlign: 'Middle' } }),
        texto(300, 0, 262, 18, 'Produto', { style: { ...CABECALHO_DE_COLUNA, vAlign: 'Middle' } }),
        texto(562, 0, 90, 18, 'Qtde', { style: { ...CABECALHO_DE_COLUNA, hAlign: 'Right', vAlign: 'Middle' } }),
        texto(652, 0, 150, 18, 'Valor', { style: { ...CABECALHO_DE_COLUNA, hAlign: 'Right', vAlign: 'Middle' } }),
      ],
    },
    detail: [
      {
        height: 14,
        splitType: 'Stretch',
        elements: [
          campo(0, 0, 70, 14, '$F{data}', { styleRef: 'linha_zebrada', pattern: DATA, blankWhenNull: true }),
          campo(70, 0, 230, 14, '$F{cliente}', { styleRef: 'linha_zebrada', blankWhenNull: true, textAdjust: 'CutText' }),
          campo(300, 0, 262, 14, '$F{produto}', { styleRef: 'linha_zebrada', blankWhenNull: true, textAdjust: 'CutText' }),
          campo(562, 0, 90, 14, '$F{quantidade}', { styleRef: 'linha_zebrada', pattern: '#,##0.###', blankWhenNull: true, style: DIREITA }),
          campo(652, 0, 150, 14, '$F{valor}', { styleRef: 'linha_zebrada', pattern: MOEDA, blankWhenNull: true, style: DIREITA }),
        ],
      },
    ],
    pageFooter: {
      height: 16,
      splitType: 'Stretch',
      elements: [campo(652, 2, 150, 12, '"Página " + $V{PAGE_NUMBER}', { style: { hAlign: 'Right', fontSize: 7 } })],
    },
    summary: {
      height: 30,
      splitType: 'Prevent',
      elements: [
        { kind: 'line', bounds: { x: 0, y: 2, width: 802, height: 1 }, pen: { lineWidth: 1 } },
        campo(0, 8, 400, 16, '$V{total_vendas} + " venda(s) no período"'),
        texto(452, 8, 200, 16, 'Total geral', { style: { bold: true, fontSize: 10, hAlign: 'Right' } }),
        campo(652, 8, 150, 16, '$V{total_geral}', { pattern: MOEDA, style: { bold: true, fontSize: 10, hAlign: 'Right' } }),
      ],
    },
    noData: {
      height: 20,
      splitType: 'Stretch',
      elements: [texto(0, 0, 802, 16, 'Nenhuma venda no período')],
    },
    groups: [
      {
        name: 'por_vendedor',
        expression: '$F{vendedor}',
        header: {
          height: 22,
          splitType: 'Prevent',
          elements: [campo(0, 4, 802, 16, '"Vendedor: " + $F{vendedor}', { style: { bold: true, fontSize: 10 } })],
        },
        footer: {
          height: 22,
          splitType: 'Prevent',
          elements: [
            { kind: 'line', bounds: { x: 400, y: 1, width: 402, height: 1 }, pen: { lineWidth: 0.5 } },
            campo(300, 4, 350, 14, '$V{vendas_vendedor} + " venda(s) — subtotal de " + $F{vendedor}', { style: DIREITA }),
            campo(652, 4, 150, 14, '$V{subtotal_vendedor}', { pattern: MOEDA, style: { ...DIREITA, ...NEGRITO } }),
          ],
        },
      },
    ],
  },
};

/**
 * Extrato de conta: lançamentos (débitos negativos em vermelho) com saldo
 * ACUMULADO = saldo anterior (parâmetro) + soma corrente dos lançamentos.
 */
export const REFERENCIA_EXTRATO_CONTA: ReportTemplate = {
  name: 'extrato_conta',
  pageFormat: a4Retrato(),
  properties: {
    'reportlenz.datasource.campo': 'lancamentos',
    'reportlenz.template.tipo': 'extrato',
  },
  styles: [
    { name: 'base', isDefault: true, fontName: 'DejaVu Sans', fontSize: 8 },
    {
      name: 'valor_lancamento',
      parentStyleRef: 'base',
      conditionalStyles: [
        { conditionExpression: '$F{valor} != null && $F{valor}.signum() < 0', style: { forecolor: '#C62828' } },
      ],
    },
  ],
  dataContract: {
    fields: [
      {
        name: 'lancamentos',
        type: 'collection',
        itemFields: [
          { name: 'data', type: 'date' },
          { name: 'historico', type: 'string' },
          { name: 'documento', type: 'string' },
          { name: 'valor', type: 'decimal' },
        ],
      },
    ],
    parameters: [
      { name: 'titular', type: 'string' },
      { name: 'agencia', type: 'string' },
      { name: 'conta', type: 'string' },
      { name: 'periodo', type: 'string' },
      { name: 'saldo_anterior', type: 'decimal', defaultValueExpression: 'java.math.BigDecimal.ZERO' },
    ],
    variables: [
      { name: 'soma_lancamentos', type: 'decimal', calculation: 'Sum', expression: '$F{valor}', resetType: 'Report' },
    ],
  },
  bands: {
    title: {
      height: 72,
      splitType: 'Stretch',
      elements: [
        texto(0, 0, 355, 20, 'Extrato de conta corrente', { style: { bold: true, fontSize: 14 } }),
        campo(0, 22, 355, 14, '$P{titular}', { blankWhenNull: true, style: { bold: true, fontSize: 10 } }),
        campo(0, 38, 355, 12, '"Agência " + $P{agencia} + " · Conta " + $P{conta}'),
        campo(355, 4, 200, 12, '$P{periodo} == null ? "" : "Período: " + $P{periodo}', { style: DIREITA }),
        texto(355, 38, 100, 12, 'Saldo anterior', { style: DIREITA }),
        campo(455, 38, 100, 12, '$P{saldo_anterior}', { pattern: MOEDA, style: { ...DIREITA, ...NEGRITO } }),
        { kind: 'line', bounds: { x: 0, y: 62, width: 555, height: 1 }, pen: { lineWidth: 0.5 } },
      ],
    },
    columnHeader: {
      height: 16,
      splitType: 'Stretch',
      elements: [
        texto(0, 0, 60, 16, 'Data', { style: { ...CABECALHO_DE_COLUNA, vAlign: 'Middle' } }),
        texto(60, 0, 235, 16, 'Histórico', { style: { ...CABECALHO_DE_COLUNA, vAlign: 'Middle' } }),
        texto(295, 0, 80, 16, 'Documento', { style: { ...CABECALHO_DE_COLUNA, vAlign: 'Middle' } }),
        texto(375, 0, 90, 16, 'Valor', { style: { ...CABECALHO_DE_COLUNA, hAlign: 'Right', vAlign: 'Middle' } }),
        texto(465, 0, 90, 16, 'Saldo', { style: { ...CABECALHO_DE_COLUNA, hAlign: 'Right', vAlign: 'Middle' } }),
      ],
    },
    detail: [
      {
        height: 13,
        splitType: 'Stretch',
        elements: [
          campo(0, 0, 60, 13, '$F{data}', { pattern: DATA, blankWhenNull: true }),
          campo(60, 0, 235, 13, '$F{historico}', { blankWhenNull: true, textAdjust: 'CutText' }),
          campo(295, 0, 80, 13, '$F{documento}', { blankWhenNull: true }),
          campo(375, 0, 90, 13, '$F{valor}', { styleRef: 'valor_lancamento', pattern: MOEDA, blankWhenNull: true, style: DIREITA }),
          campo(465, 0, 90, 13, '$P{saldo_anterior}.add($V{soma_lancamentos})', { pattern: MOEDA, style: DIREITA }),
        ],
      },
    ],
    pageFooter: {
      height: 16,
      splitType: 'Stretch',
      elements: [campo(455, 2, 100, 12, '"Página " + $V{PAGE_NUMBER}', { style: { hAlign: 'Right', fontSize: 7 } })],
    },
    summary: {
      height: 26,
      splitType: 'Prevent',
      elements: [
        { kind: 'line', bounds: { x: 0, y: 2, width: 555, height: 1 }, pen: { lineWidth: 1 } },
        texto(355, 8, 100, 14, 'Saldo final', { style: { bold: true, hAlign: 'Right' } }),
        campo(455, 8, 100, 14, '$P{saldo_anterior}.add($V{soma_lancamentos})', { pattern: MOEDA, style: { bold: true, hAlign: 'Right' } }),
      ],
    },
    noData: {
      height: 20,
      splitType: 'Stretch',
      elements: [texto(0, 0, 555, 16, 'Sem lançamentos no período')],
    },
    groups: [],
  },
};
