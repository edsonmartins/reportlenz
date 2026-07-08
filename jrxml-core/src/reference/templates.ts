/**
 * Templates de referência do ReportLenz (tarefas phase-0/5.2 e 8.1).
 *
 * São modelos Push completos usados em três papéis:
 * 1. round-trip tests do core (serialize ∘ parse);
 * 2. fixtures do harness Java — cada um DEVE ser aceito pelo load+compile da
 *    Library 7.0.7 real (gate G1, ADR-013);
 * 3. exemplos de partida para o designer (Fase 2).
 *
 * Nota: expressões de variáveis são tipadas com cuidado — a Library envolve a
 * expressão num cast para a classe da variável na compilação.
 */
import type { ReportTemplate } from '../model/report.js';

/** Fatura A4 completa: estilos condicionais, grupo, tabela Push, QR, subreport. */
export const REFERENCIA_FATURA: ReportTemplate = {
  name: 'fatura_completa',
  pageFormat: {
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
  },
  properties: { 'reportlenz.template.tipo': 'fatura' },
  styles: [
    { name: 'base', isDefault: true, fontName: 'DejaVu Sans', fontSize: 10 },
    {
      name: 'linha_zebrada',
      parentStyleRef: 'base',
      mode: 'Transparent',
      conditionalStyles: [
        { conditionExpression: '$V{REPORT_COUNT}%2 == 0', style: { mode: 'Opaque', backcolor: '#F0EFEF' } },
      ],
    },
  ],
  dataContract: {
    fields: [
      { name: 'categoria', type: 'string' },
      { name: 'cliente_nome', type: 'string', description: 'Nome do cliente' },
      {
        name: 'itens',
        type: 'collection',
        itemFields: [
          { name: 'descricao', type: 'string' },
          { name: 'valor', type: 'decimal' },
        ],
      },
      { name: 'entregas', type: 'collection' },
    ],
    parameters: [
      { name: 'logo_url', type: 'string' },
      { name: 'titulo', type: 'string', description: 'Título do relatório', defaultValueExpression: '"Fatura"' },
      { name: 'sub_template', type: 'string' },
    ],
    variables: [
      {
        name: 'total_registros',
        type: 'integer',
        calculation: 'Count',
        expression: '$F{categoria}',
        resetType: 'Report',
      },
      {
        name: 'contador_categoria',
        type: 'integer',
        calculation: 'Count',
        expression: '$F{categoria}',
        resetType: 'Group',
        resetGroup: 'por_categoria',
      },
    ],
  },
  bands: {
    background: { height: 780, splitType: 'Stretch', elements: [] },
    title: {
      height: 60,
      splitType: 'Stretch',
      elements: [
        { kind: 'textField', bounds: { x: 0, y: 0, width: 300, height: 30 }, styleRef: 'base', expression: '$P{titulo}' },
        { kind: 'image', bounds: { x: 455, y: 0, width: 100, height: 50 }, expression: '$P{logo_url}', scaleImage: 'RetainShape', onErrorType: 'Blank' },
        { kind: 'line', bounds: { x: 0, y: 55, width: 555, height: 1 }, pen: { lineWidth: 0.5, lineStyle: 'Solid', lineColor: '#000000' } },
      ],
    },
    pageHeader: {
      height: 20,
      splitType: 'Stretch',
      elements: [
        { kind: 'staticText', bounds: { x: 0, y: 0, width: 200, height: 16 }, text: 'Cliente & <detalhes>' },
      ],
    },
    columnHeader: {
      height: 16,
      splitType: 'Stretch',
      elements: [
        { kind: 'rectangle', bounds: { x: 0, y: 0, width: 555, height: 16 }, radius: 3, pen: { lineWidth: 0.25 } },
      ],
    },
    detail: [
      {
        height: 140,
        splitType: 'Stretch',
        printWhenExpression: '$F{itens} != null',
        elements: [
          {
            kind: 'textField',
            bounds: { x: 0, y: 0, width: 300, height: 16 },
            expression: '$F{cliente_nome}',
            blankWhenNull: true,
            textAdjust: 'StretchHeight',
            style: { hAlign: 'Right', bold: true },
          },
          {
            kind: 'table',
            bounds: { x: 0, y: 20, width: 555, height: 100 },
            styleRef: 'base',
            datasetField: 'itens',
            columns: [
              {
                width: 355,
                header: {
                  height: 20,
                  styleRef: 'base',
                  elements: [{ kind: 'staticText', bounds: { x: 0, y: 0, width: 355, height: 20 }, text: 'Descrição' }],
                },
                detail: {
                  height: 16,
                  elements: [{ kind: 'textField', bounds: { x: 0, y: 0, width: 355, height: 16 }, expression: '$F{descricao}' }],
                },
              },
              {
                width: 200,
                detail: {
                  height: 16,
                  elements: [
                    { kind: 'textField', bounds: { x: 0, y: 0, width: 200, height: 16 }, expression: '$F{valor}', pattern: '¤ #,##0.00' },
                  ],
                },
                footer: {
                  height: 18,
                  elements: [{ kind: 'staticText', bounds: { x: 0, y: 0, width: 200, height: 18 }, text: 'Total' }],
                },
              },
            ],
          },
          {
            kind: 'barcode',
            bounds: { x: 400, y: 0, width: 155, height: 18 },
            barcodeType: 'QRCode',
            expression: '$F{cliente_nome}',
          },
          { kind: 'ellipse', bounds: { x: 0, y: 125, width: 10, height: 10 } },
        ],
      },
    ],
    columnFooter: { height: 14, splitType: 'Stretch', elements: [] },
    pageFooter: {
      height: 20,
      splitType: 'Stretch',
      elements: [
        { kind: 'textField', bounds: { x: 455, y: 0, width: 100, height: 16 }, expression: '$V{PAGE_NUMBER}' },
      ],
    },
    summary: {
      height: 80,
      splitType: 'Prevent',
      elements: [
        {
          kind: 'frame',
          bounds: { x: 300, y: 0, width: 255, height: 30 },
          elements: [
            { kind: 'staticText', bounds: { x: 0, y: 0, width: 80, height: 20 }, text: 'Registros:' },
            { kind: 'textField', bounds: { x: 80, y: 0, width: 175, height: 20 }, expression: '$V{total_registros}', pattern: '#,##0' },
          ],
        },
        {
          kind: 'subreport',
          bounds: { x: 0, y: 40, width: 555, height: 30 },
          templateExpression: '$P{sub_template}',
          dataSourceExpression: 'new net.sf.jasperreports.engine.data.JRBeanCollectionDataSource($F{entregas})',
          parameters: [{ name: 'cliente', expression: '$F{cliente_nome}' }],
          printWhenExpression: '$F{entregas} != null',
        },
      ],
    },
    noData: {
      height: 30,
      splitType: 'Stretch',
      elements: [{ kind: 'staticText', bounds: { x: 0, y: 0, width: 555, height: 20 }, text: 'Sem dados' }],
    },
    groups: [
      {
        name: 'por_categoria',
        expression: '$F{categoria}',
        startNewPage: true,
        header: {
          height: 20,
          splitType: 'Stretch',
          elements: [{ kind: 'textField', bounds: { x: 0, y: 0, width: 200, height: 16 }, expression: '$F{categoria}' }],
        },
        footer: { height: 10, splitType: 'Stretch', elements: [] },
      },
    ],
  },
};

/**
 * Conjunto de referência (nome → template). A tarefa 8.1 completa o quarteto
 * fatura/comprovante/formulário/etiqueta A4.
 */
export const REFERENCE_TEMPLATES: Record<string, ReportTemplate> = {
  fatura: REFERENCIA_FATURA,
};
