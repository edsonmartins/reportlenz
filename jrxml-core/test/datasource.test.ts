import { describe, expect, it } from 'vitest';
import { colecaoDoDatasource, datasourceCampo, PROPRIEDADE_DATASOURCE } from '../src/model/datasource.js';
import type { ReportTemplate } from '../src/model/report.js';
import { parseJrxml } from '../src/parse/parseJrxml.js';
import { avaliarGates } from '../src/publish/gates.js';
import { serializeJrxml } from '../src/serialize/serializeJrxml.js';
import { validateContract } from '../src/validate/validateContract.js';

/**
 * Grade multi-registro em modo Push (ADR-015, change grade-multiregistro-push,
 * tarefas 1.1-1.4): a property `reportlenz.datasource.campo` faz os itemFields
 * da coleção virarem os `<field>` MESTRE (um item = uma linha/etiqueta).
 */

const ETIQUETA_GRADE: ReportTemplate = {
  name: 'etiqueta_grade',
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
    printOrder: 'Horizontal',
  },
  properties: { [PROPRIEDADE_DATASOURCE]: 'etiquetas' },
  styles: [{ name: 'base', isDefault: true, fontName: 'DejaVu Sans', fontSize: 8 }],
  dataContract: {
    fields: [
      {
        name: 'etiquetas',
        type: 'collection',
        itemFields: [
          { name: 'produto_nome', type: 'string' },
          { name: 'preco', type: 'decimal' },
          { name: 'ean', type: 'string' },
        ],
      },
    ],
    parameters: [{ name: 'filial', type: 'string' }],
    variables: [],
  },
  bands: {
    detail: [
      {
        height: 90,
        splitType: 'Prevent',
        elements: [
          { kind: 'textField', bounds: { x: 2, y: 2, width: 174, height: 20 }, expression: '$F{produto_nome}' },
          { kind: 'textField', bounds: { x: 2, y: 24, width: 174, height: 14 }, expression: '$F{preco}', pattern: '¤ #,##0.00' },
          { kind: 'barcode', bounds: { x: 2, y: 42, width: 174, height: 44 }, barcodeType: 'EAN13', expression: '$F{ean}' },
        ],
      },
    ],
    groups: [],
  },
};

const clonar = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe('jrxml-core · grade multi-registro Push (ADR-015, tarefas 1.1-1.4)', () => {
  it('1.1: helpers resolvem a coleção-datasource pela property', () => {
    expect(datasourceCampo(ETIQUETA_GRADE)).toBe('etiquetas');
    expect(colecaoDoDatasource(ETIQUETA_GRADE)?.itemFields?.map((f) => f.name)).toEqual([
      'produto_nome', 'preco', 'ean',
    ]);
  });

  it('1.2: serializer emite os itemFields como <field> MESTRE (e não a coleção)', () => {
    const xml = serializeJrxml(ETIQUETA_GRADE);
    expect(xml).toContain('reportlenz.datasource.campo');
    expect(xml).toContain('<field name="produto_nome" class="java.lang.String"/>');
    expect(xml).toContain('<field name="preco" class="java.math.BigDecimal"/>');
    expect(xml).not.toContain('name="etiquetas"'); // nem field List, nem dataset
    expect(xml).not.toContain('<dataset');
  });

  it('1.3: round-trip preserva property e reconstrói a coleção com itemFields', () => {
    const xml = serializeJrxml(ETIQUETA_GRADE);
    const resultado = parseJrxml(xml);
    if (!resultado.ok) throw new Error(JSON.stringify(resultado.errors));
    expect(resultado.value.properties[PROPRIEDADE_DATASOURCE]).toBe('etiquetas');
    expect(resultado.value.dataContract).toEqual(ETIQUETA_GRADE.dataContract);
    // Idempotência: serializar de novo produz o MESMO JRXML.
    expect(serializeJrxml(resultado.value)).toBe(xml);
  });

  it('1.4: bandas validam no escopo dos itemFields; gates G1-G6 verdes', () => {
    expect(validateContract(ETIQUETA_GRADE).messages).toEqual([]);
    const gates = avaliarGates(ETIQUETA_GRADE);
    expect(gates.verde).toBe(true);
  });

  it('1.4: field escalar de topo junto da grade é recusado (mova para parameter)', () => {
    const t = clonar(ETIQUETA_GRADE);
    t.dataContract.fields.push({ name: 'solto', type: 'string' });
    const msgs = validateContract(t).messages;
    expect(msgs.some((m) => m.message.includes('"solto"') && m.message.includes('parameter'))).toBe(true);
  });

  it('1.4: property apontando coleção inexistente é recusada', () => {
    const t = clonar(ETIQUETA_GRADE);
    t.properties[PROPRIEDADE_DATASOURCE] = 'fantasma';
    const msgs = validateContract(t).messages;
    expect(msgs.some((m) => m.message.includes('fantasma'))).toBe(true);
  });

  it('1.4: restrição V1 — table/subreport proibidos com a grade ativa', () => {
    const t = clonar(ETIQUETA_GRADE);
    t.bands.detail[0]!.elements.push({
      kind: 'subreport',
      bounds: { x: 0, y: 86, width: 100, height: 4 },
      templateExpression: '$P{filial}',
      parameters: [],
    });
    const msgs = validateContract(t).messages;
    expect(msgs.some((m) => m.message.includes('subreport') && m.message.includes('ADR-015'))).toBe(true);
  });

  it('sem a property, nada muda (retrocompatibilidade)', () => {
    const t = clonar(ETIQUETA_GRADE);
    delete t.properties[PROPRIEDADE_DATASOURCE];
    // Agora $F{produto_nome} NÃO existe no topo — a validação acusa (escopo antigo).
    const msgs = validateContract(t).messages;
    expect(msgs.some((m) => m.code === 'EXPR_UNKNOWN_REF')).toBe(true);
  });
});
