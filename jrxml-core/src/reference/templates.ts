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
 * Comprovante de entrega A4 (espelha o exemplo da RFC-002 §2): campos com
 * nome pontuado (`pedido.numero`, `cliente.nome`) que exercitam a heurística
 * de agrupamento do inputSchema, itens em tabela Push e QR de conferência.
 */
export const REFERENCIA_COMPROVANTE: ReportTemplate = {
  name: 'comprovante_entrega',
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
  properties: { 'reportlenz.template.tipo': 'comprovante' },
  styles: [{ name: 'base', isDefault: true, fontName: 'DejaVu Sans', fontSize: 9 }],
  dataContract: {
    fields: [
      { name: 'pedido.numero', type: 'string' },
      { name: 'pedido.data', type: 'date' },
      { name: 'pedido.qrPayload', type: 'string', description: 'Conteúdo do QR de conferência' },
      { name: 'cliente.nome', type: 'string' },
      { name: 'cliente.documento', type: 'string' },
      { name: 'cliente.endereco', type: 'string' },
      {
        name: 'itens',
        type: 'collection',
        itemFields: [
          { name: 'descricao', type: 'string' },
          { name: 'quantidade', type: 'decimal' },
          { name: 'unidade', type: 'string' },
        ],
      },
    ],
    parameters: [],
    variables: [],
  },
  bands: {
    title: {
      height: 50,
      splitType: 'Stretch',
      elements: [
        { kind: 'staticText', bounds: { x: 0, y: 0, width: 350, height: 22 }, style: { fontSize: 14, bold: true }, text: 'Comprovante de Entrega' },
        {
          kind: 'barcode',
          bounds: { x: 475, y: 0, width: 80, height: 45 },
          barcodeType: 'QRCode',
          expression: '$F{pedido.qrPayload}',
        },
        { kind: 'line', bounds: { x: 0, y: 47, width: 555, height: 1 }, pen: { lineWidth: 0.5 } },
      ],
    },
    detail: [
      {
        height: 160,
        splitType: 'Stretch',
        elements: [
          { kind: 'staticText', bounds: { x: 0, y: 0, width: 80, height: 14 }, style: { bold: true }, text: 'Pedido:' },
          { kind: 'textField', bounds: { x: 80, y: 0, width: 150, height: 14 }, expression: '$F{pedido.numero}' },
          { kind: 'textField', bounds: { x: 250, y: 0, width: 120, height: 14 }, expression: '$F{pedido.data}', pattern: 'dd/MM/yyyy' },
          { kind: 'staticText', bounds: { x: 0, y: 18, width: 80, height: 14 }, style: { bold: true }, text: 'Cliente:' },
          { kind: 'textField', bounds: { x: 80, y: 18, width: 300, height: 14 }, expression: '$F{cliente.nome}' },
          { kind: 'textField', bounds: { x: 390, y: 18, width: 165, height: 14 }, expression: '$F{cliente.documento}' },
          { kind: 'textField', bounds: { x: 80, y: 34, width: 475, height: 14 }, expression: '$F{cliente.endereco}', textAdjust: 'StretchHeight' },
          {
            kind: 'table',
            bounds: { x: 0, y: 56, width: 555, height: 90 },
            datasetField: 'itens',
            columns: [
              {
                width: 315,
                header: { height: 16, elements: [{ kind: 'staticText', bounds: { x: 0, y: 0, width: 315, height: 16 }, style: { bold: true }, text: 'Descrição' }] },
                detail: { height: 14, elements: [{ kind: 'textField', bounds: { x: 0, y: 0, width: 315, height: 14 }, expression: '$F{descricao}' }] },
              },
              {
                width: 120,
                header: { height: 16, elements: [{ kind: 'staticText', bounds: { x: 0, y: 0, width: 120, height: 16 }, style: { bold: true }, text: 'Qtde' }] },
                detail: {
                  height: 14,
                  elements: [{ kind: 'textField', bounds: { x: 0, y: 0, width: 120, height: 14 }, expression: '$F{quantidade}', pattern: '#,##0.###', style: { hAlign: 'Right' } }],
                },
              },
              {
                width: 120,
                header: { height: 16, elements: [{ kind: 'staticText', bounds: { x: 0, y: 0, width: 120, height: 16 }, style: { bold: true }, text: 'Unid.' }] },
                detail: { height: 14, elements: [{ kind: 'textField', bounds: { x: 0, y: 0, width: 120, height: 14 }, expression: '$F{unidade}' }] },
              },
            ],
          },
        ],
      },
    ],
    summary: {
      height: 70,
      splitType: 'Prevent',
      elements: [
        { kind: 'line', bounds: { x: 0, y: 40, width: 250, height: 1 }, pen: { lineWidth: 0.5 } },
        { kind: 'staticText', bounds: { x: 0, y: 44, width: 250, height: 14 }, text: 'Assinatura do recebedor' },
        { kind: 'textField', bounds: { x: 305, y: 44, width: 250, height: 14 }, expression: '$F{cliente.nome}', blankWhenNull: true },
      ],
    },
    groups: [],
  },
};

/** Formulário A4 (ficha cadastral): rótulos fixos + campos, sem tabela. */
export const REFERENCIA_FORMULARIO: ReportTemplate = {
  name: 'formulario_cadastro',
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
  properties: { 'reportlenz.template.tipo': 'formulario' },
  styles: [
    { name: 'rotulo', isDefault: false, fontName: 'DejaVu Sans', fontSize: 8, bold: true },
    { name: 'valor', isDefault: true, fontName: 'DejaVu Sans', fontSize: 10 },
  ],
  dataContract: {
    fields: [
      { name: 'nome', type: 'string' },
      { name: 'documento', type: 'string' },
      { name: 'nascimento', type: 'date' },
      { name: 'ativo', type: 'boolean' },
      { name: 'observacoes', type: 'string' },
    ],
    parameters: [{ name: 'titulo_ficha', type: 'string', defaultValueExpression: '"Ficha Cadastral"' }],
    variables: [],
  },
  bands: {
    title: {
      height: 40,
      splitType: 'Stretch',
      elements: [
        { kind: 'textField', bounds: { x: 0, y: 0, width: 555, height: 24 }, style: { fontSize: 16, bold: true, hAlign: 'Center' }, expression: '$P{titulo_ficha}' },
        { kind: 'rectangle', bounds: { x: 0, y: 30, width: 555, height: 6 }, pen: { lineWidth: 0.25 } },
      ],
    },
    detail: [
      {
        height: 120,
        splitType: 'Prevent',
        elements: [
          {
            kind: 'frame',
            bounds: { x: 0, y: 0, width: 555, height: 56 },
            elements: [
              { kind: 'staticText', bounds: { x: 4, y: 2, width: 200, height: 10 }, styleRef: 'rotulo', text: 'NOME COMPLETO' },
              { kind: 'textField', bounds: { x: 4, y: 14, width: 340, height: 14 }, expression: '$F{nome}' },
              { kind: 'staticText', bounds: { x: 360, y: 2, width: 100, height: 10 }, styleRef: 'rotulo', text: 'DOCUMENTO' },
              { kind: 'textField', bounds: { x: 360, y: 14, width: 190, height: 14 }, expression: '$F{documento}' },
              { kind: 'staticText', bounds: { x: 4, y: 30, width: 100, height: 10 }, styleRef: 'rotulo', text: 'NASCIMENTO' },
              { kind: 'textField', bounds: { x: 4, y: 42, width: 120, height: 14 }, expression: '$F{nascimento}', pattern: 'dd/MM/yyyy' },
              { kind: 'staticText', bounds: { x: 360, y: 30, width: 100, height: 10 }, styleRef: 'rotulo', text: 'SITUAÇÃO' },
              {
                kind: 'textField',
                bounds: { x: 360, y: 42, width: 120, height: 14 },
                expression: '$F{ativo} ? "Ativo" : "Inativo"',
                printWhenExpression: '$F{ativo} != null',
              },
            ],
          },
          { kind: 'staticText', bounds: { x: 0, y: 64, width: 200, height: 10 }, styleRef: 'rotulo', text: 'OBSERVAÇÕES' },
          { kind: 'textField', bounds: { x: 0, y: 76, width: 555, height: 40 }, expression: '$F{observacoes}', blankWhenNull: true, textAdjust: 'StretchHeight' },
        ],
      },
    ],
    pageFooter: {
      height: 16,
      splitType: 'Stretch',
      elements: [
        { kind: 'textField', bounds: { x: 455, y: 0, width: 100, height: 12 }, style: { hAlign: 'Right', fontSize: 7 }, expression: '$V{PAGE_NUMBER}' },
      ],
    },
    groups: [],
  },
};

/** Etiqueta A4 multi-coluna (laser, 3 colunas) com EAN-13 — térmica fora de escopo (ADR-011). */
export const REFERENCIA_ETIQUETA_A4: ReportTemplate = {
  name: 'etiqueta_a4_3col',
  pageFormat: {
    pageWidth: 595,
    pageHeight: 842,
    orientation: 'Portrait',
    leftMargin: 20,
    rightMargin: 20,
    topMargin: 30,
    bottomMargin: 30,
    columnCount: 3,
    columnWidth: 178,
    columnSpacing: 10,
  },
  properties: { 'reportlenz.template.tipo': 'etiqueta_a4' },
  styles: [{ name: 'base', isDefault: true, fontName: 'DejaVu Sans', fontSize: 8 }],
  dataContract: {
    fields: [
      { name: 'produto_nome', type: 'string' },
      { name: 'preco', type: 'decimal' },
      { name: 'ean', type: 'string' },
    ],
    parameters: [],
    variables: [],
  },
  bands: {
    detail: [
      {
        height: 90,
        splitType: 'Prevent',
        elements: [
          { kind: 'textField', bounds: { x: 2, y: 2, width: 174, height: 20 }, expression: '$F{produto_nome}', textAdjust: 'CutText' },
          { kind: 'textField', bounds: { x: 2, y: 24, width: 174, height: 14 }, style: { bold: true, hAlign: 'Right' }, expression: '$F{preco}', pattern: '¤ #,##0.00' },
          { kind: 'barcode', bounds: { x: 2, y: 42, width: 174, height: 44 }, barcodeType: 'EAN13', expression: '$F{ean}' },
        ],
      },
    ],
    groups: [],
  },
};

/**
 * Conjunto de referência (nome → template): o quarteto da RFC-001 §7 —
 * fatura, comprovante, formulário e etiqueta A4 (tarefa 8.1).
 */
export const REFERENCE_TEMPLATES: Record<string, ReportTemplate> = {
  fatura: REFERENCIA_FATURA,
  comprovante: REFERENCIA_COMPROVANTE,
  formulario: REFERENCIA_FORMULARIO,
  etiqueta_a4: REFERENCIA_ETIQUETA_A4,
};
