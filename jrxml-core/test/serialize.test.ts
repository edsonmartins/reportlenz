import { describe, expect, it } from 'vitest';
import type { ReportTemplate } from '../src/index.js';
import { parseJrxml, serializeJrxml } from '../src/index.js';

/**
 * Testes do serializer (phase-0/5.1). O round-trip TS (parse ∘ serialize)
 * verifica equivalência semântica; a aceitação pela Library real é o harness
 * Java da tarefa 5.2 (ADR-013).
 *
 * Nota: `FieldDecl.required` não tem representação em JRXML — vive no
 * inputSchema persistido à parte (ADR-009/RFC-002) — e por isso não aparece
 * neste fixture.
 */
const FATURA: ReportTemplate = {
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
        name: 'total_geral',
        type: 'decimal',
        calculation: 'Sum',
        expression: '$F{itens}.size()',
        resetType: 'Report',
        initialValueExpression: 'java.math.BigDecimal.ZERO',
      },
      { name: 'contador_categoria', type: 'integer', calculation: 'Count', expression: '$F{categoria}', resetType: 'Group', resetGroup: 'por_categoria' },
    ],
  },
  bands: {
    background: { height: 802, splitType: 'Stretch', elements: [] },
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
            pattern: '¤ #,##0.00',
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
                  elements: [{ kind: 'textField', bounds: { x: 0, y: 0, width: 200, height: 16 }, expression: '$F{valor}' }],
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
    columnFooter: {
      height: 14,
      splitType: 'Stretch',
      elements: [],
    },
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
            { kind: 'staticText', bounds: { x: 0, y: 0, width: 80, height: 20 }, text: 'Total:' },
            { kind: 'textField', bounds: { x: 80, y: 0, width: 175, height: 20 }, expression: '$V{total_geral}', pattern: '¤ #,##0.00' },
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

describe('jrxml-core · serializeJrxml (5.1)', () => {
  it('round-trip TS: parse(serialize(t)) é semanticamente equivalente a t', () => {
    const xml = serializeJrxml(FATURA);
    const result = parseJrxml(xml);
    if (!result.ok) {
      throw new Error('parse falhou: ' + JSON.stringify(result.errors, null, 2));
    }
    expect(result.value).toEqual(FATURA);
  });

  it('é determinístico: mesmo modelo → mesmo XML byte a byte', () => {
    expect(serializeJrxml(FATURA)).toBe(serializeJrxml(FATURA));
  });

  it('nunca emite query/queryString (anti-Pull por construção, G2)', () => {
    const xml = serializeJrxml(FATURA);
    expect(xml).not.toContain('<query');
    expect(xml).not.toContain('queryString');
    expect(xml).not.toContain('connectionExpression');
  });

  it('emite o dialeto 7: element kind, raiz sem namespace, tabela via component', () => {
    const xml = serializeJrxml(FATURA);
    expect(xml).toContain('<jasperReport name="fatura_completa"');
    expect(xml).not.toContain('xmlns');
    expect(xml).not.toContain('<reportElement');
    expect(xml).toContain('<element kind="staticText"');
    expect(xml).toContain('<component kind="table">');
    expect(xml).toContain('<component kind="barcode4j:QRCode">');
    expect(xml).toContain('subDataset="itens_ds"');
    expect(xml).toContain('<dataset name="itens_ds">');
  });

  it('escapa atributos e protege CDATA contra ]]>', () => {
    const t: ReportTemplate = {
      ...FATURA,
      properties: { 'a<b': 'x "&" y' },
      bands: {
        detail: [
          {
            height: 20,
            splitType: 'Stretch',
            elements: [
              { kind: 'staticText', bounds: { x: 0, y: 0, width: 10, height: 10 }, text: 'fecha ]]> cedo' },
            ],
          },
        ],
        groups: [],
      },
    };
    const xml = serializeJrxml(t);
    expect(xml).toContain('name="a&lt;b" value="x &quot;&amp;&quot; y"');
    expect(xml).toContain(']]]]><![CDATA[>');
    const result = parseJrxml(xml);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const st = result.value.bands.detail[0]?.elements[0];
    expect(st?.kind === 'staticText' && st.text).toBe('fecha ]]> cedo');
  });
});
