import { describe, expect, it } from 'vitest';
import type { Element, PageFormat, ReportTemplate, TextField } from '../src/index.js';

/**
 * Testes do modelo de domínio (phase-0/3.1): provam que os tipos expressam o
 * subconjunto fatura/comprovante/formulário/etiqueta A4 (RFC-001 §3 e §7).
 * A validação forte é o typecheck; os asserts cobrem a forma em runtime.
 */

const A4: PageFormat = {
  pageWidth: 595,
  pageHeight: 842,
  orientation: 'Portrait',
  leftMargin: 20,
  rightMargin: 20,
  topMargin: 20,
  bottomMargin: 20,
  columnCount: 1,
  columnWidth: 555,
  columnSpacing: 0,
};

describe('jrxml-core · modelo de domínio', () => {
  it('expressa uma fatura: título, grupo por categoria, tabela de itens e sumário', () => {
    const totalGeral: TextField = {
      kind: 'textField',
      bounds: { x: 400, y: 4, width: 155, height: 20 },
      expression: '$V{total_geral}',
      pattern: '¤ #,##0.00',
      blankWhenNull: true,
    };

    const fatura: ReportTemplate = {
      name: 'fatura',
      pageFormat: A4,
      properties: { 'reportlenz.template.tipo': 'fatura' },
      dataContract: {
        fields: [
          { name: 'categoria', type: 'string', required: true },
          {
            name: 'itens',
            type: 'collection',
            required: true,
            description: 'Itens da fatura (alimenta a tabela)',
            itemFields: [
              { name: 'descricao', type: 'string', required: true },
              { name: 'valor', type: 'decimal', required: true },
            ],
          },
        ],
        parameters: [{ name: 'logo_url', type: 'string' }],
        variables: [
          { name: 'total_geral', type: 'decimal', calculation: 'Sum', expression: '$F{valor}', resetType: 'Report' },
        ],
      },
      styles: [
        {
          name: 'linha_zebrada',
          mode: 'Transparent',
          conditionalStyles: [
            { conditionExpression: '$V{REPORT_COUNT}%2 == 0', style: { mode: 'Opaque', backcolor: '#F0EFEF' } },
          ],
        },
      ],
      bands: {
        title: {
          height: 60,
          splitType: 'Stretch',
          elements: [
            { kind: 'staticText', bounds: { x: 0, y: 0, width: 300, height: 30 }, text: 'Fatura' },
            { kind: 'image', bounds: { x: 455, y: 0, width: 100, height: 50 }, expression: '$P{logo_url}', scaleImage: 'RetainShape' },
          ],
        },
        detail: [
          {
            height: 120,
            splitType: 'Stretch',
            elements: [
              {
                kind: 'table',
                bounds: { x: 0, y: 0, width: 555, height: 100 },
                datasetField: 'itens',
                columns: [
                  {
                    width: 355,
                    header: { height: 20, elements: [{ kind: 'staticText', bounds: { x: 0, y: 0, width: 355, height: 20 }, text: 'Descrição' }] },
                    detail: { height: 20, styleRef: 'linha_zebrada', elements: [{ kind: 'textField', bounds: { x: 0, y: 0, width: 355, height: 20 }, expression: '$F{descricao}' }] },
                  },
                  {
                    width: 200,
                    detail: { height: 20, elements: [{ kind: 'textField', bounds: { x: 0, y: 0, width: 200, height: 20 }, expression: '$F{valor}', pattern: '¤ #,##0.00' }] },
                  },
                ],
              },
            ],
          },
        ],
        summary: { height: 30, splitType: 'Prevent', elements: [totalGeral] },
        groups: [
          {
            name: 'por_categoria',
            expression: '$F{categoria}',
            header: { height: 20, splitType: 'Stretch', elements: [] },
          },
        ],
      },
    };

    expect(fatura.bands.detail).toHaveLength(1);
    expect(fatura.bands.groups[0]?.expression).toBe('$F{categoria}');
    const tabela = fatura.bands.detail[0]?.elements[0];
    expect(tabela?.kind).toBe('table');

    // Contrato (phase-0/3.2): coleção com itemFields alimenta a tabela;
    // variável é derivada (Sum) e não representa dado do payload.
    const itens = fatura.dataContract.fields.find((f) => f.name === 'itens');
    expect(itens?.type).toBe('collection');
    expect(itens?.itemFields?.map((f) => f.name)).toEqual(['descricao', 'valor']);
    expect(fatura.dataContract.variables[0]?.calculation).toBe('Sum');
  });

  it('expressa uma etiqueta A4 multi-coluna com código de barras (ADR-011: laser, não térmica)', () => {
    const etiqueta: ReportTemplate = {
      name: 'etiqueta_a4_3col',
      pageFormat: { ...A4, columnCount: 3, columnWidth: 178, columnSpacing: 10 },
      properties: {},
      styles: [],
      dataContract: {
        fields: [
          { name: 'produto_nome', type: 'string', required: true },
          { name: 'ean', type: 'string', required: true },
        ],
        parameters: [],
        variables: [],
      },
      bands: {
        detail: [
          {
            height: 80,
            splitType: 'Prevent',
            elements: [
              { kind: 'textField', bounds: { x: 0, y: 0, width: 178, height: 16 }, expression: '$F{produto_nome}', textAdjust: 'CutText' },
              { kind: 'barcode', bounds: { x: 0, y: 20, width: 178, height: 50 }, barcodeType: 'EAN13', expression: '$F{ean}' },
            ],
          },
        ],
        groups: [],
      },
    };

    expect(etiqueta.pageFormat.columnCount).toBe(3);
    const barcode = etiqueta.bands.detail[0]?.elements[1];
    expect(barcode?.kind === 'barcode' && barcode.barcodeType).toBe('EAN13');
  });

  it('discrimina a união Element por kind (narrowing para o serializer/parser)', () => {
    const el: Element = {
      kind: 'frame',
      bounds: { x: 0, y: 0, width: 100, height: 40 },
      elements: [{ kind: 'line', bounds: { x: 0, y: 0, width: 100, height: 1 }, pen: { lineWidth: 0.5 } }],
    };

    // Narrowing: dentro do if, o TS sabe que é FrameElement.
    if (el.kind === 'frame') {
      expect(el.elements).toHaveLength(1);
    } else {
      expect.unreachable('kind deveria ser frame');
    }
  });
});
