import { describe, expect, it } from 'vitest';
import type { ReportTemplate } from '../src/index.js';
import { REFERENCIA_FATURA, serializeJrxml, validateContract, validateSchema } from '../src/index.js';

/**
 * Testes do bloco 6: validateSchema (6.1, estrutural — ADR-013),
 * validateContract (6.2, gate G3) e mensagens com linha/elemento (6.3).
 */

/** Clone profundo de dados puros (sem structuredClone: fora do lib set sem DOM). */
function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T;
}

describe('jrxml-core · validateSchema (6.1)', () => {
  it('aceita o template de referência serializado', () => {
    const result = validateSchema(serializeJrxml(REFERENCIA_FATURA));
    expect(result.valid).toBe(true);
    expect(result.messages).toEqual([]);
  });

  it('cenário do spec: queryString → CONTRACT_PULL_FORBIDDEN e template inválido para save', () => {
    const result = validateSchema('<jasperReport name="x">\n\t<queryString><![CDATA[SELECT 1]]></queryString>\n</jasperReport>');
    expect(result.valid).toBe(false);
    expect(result.messages[0]?.code).toBe('CONTRACT_PULL_FORBIDDEN');
    // 6.3: linha do elemento ofensor no XML de origem
    expect(result.messages[0]?.line).toBe(2);
  });

  it('reporta linha/coluna para XML mal-formado', () => {
    const result = validateSchema('<jasperReport name="x">\n<detail>\n</jasperReport>');
    expect(result.valid).toBe(false);
    expect(result.messages[0]?.code).toBe('XML_MALFORMED');
    expect(result.messages[0]?.line).toBeGreaterThan(0);
  });

  it('anota linha em erros de elemento (UNSUPPORTED_ELEMENT)', () => {
    const xml = [
      '<jasperReport name="x">',
      '\t<detail>',
      '\t\t<band height="20">',
      '\t\t\t<element kind="staticText" x="0" y="0" width="10" height="10"><text>ok</text></element>',
      '\t\t\t<element kind="crosstab" x="0" y="0" width="10" height="10"/>',
      '\t\t</band>',
      '\t</detail>',
      '</jasperReport>',
    ].join('\n');
    const result = validateSchema(xml);
    expect(result.valid).toBe(false);
    const e = result.messages.find((m) => m.code === 'UNSUPPORTED_ELEMENT');
    expect(e?.path).toBe('jasperReport/detail/band[0]/element[1]');
    expect(e?.line).toBe(5);
  });

  it('ignora conteúdo de CDATA ao localizar linhas (expressões com <)', () => {
    const xml = [
      '<jasperReport name="x">',
      '\t<field name="a" class="java.lang.Integer"/>',
      '\t<detail>',
      '\t\t<band height="20">',
      '\t\t\t<element kind="textField" x="0" y="0" width="10" height="10">',
      '\t\t\t\t<expression><![CDATA[$F{a} < 10 && $F{a} > <um> "não-tag"]]></expression>',
      '\t\t\t</element>',
      '\t\t\t<element kind="grafico3d" x="0" y="0" width="10" height="10"/>',
      '\t\t</band>',
      '\t</detail>',
      '</jasperReport>',
    ].join('\n');
    const result = validateSchema(xml);
    expect(result.valid).toBe(false);
    const e = result.messages.find((m) => m.code === 'UNSUPPORTED_ELEMENT');
    expect(e?.line).toBe(8);
  });
});

describe('jrxml-core · validateContract (6.2, G3)', () => {
  it('aceita o template de referência (built-ins REPORT_COUNT/PAGE_NUMBER incluídos)', () => {
    const result = validateContract(REFERENCIA_FATURA);
    expect(result.messages).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('cenário do spec: $F{x} não declarado → EXPR_UNKNOWN_REF com nome e localização', () => {
    const t: ReportTemplate = clone(REFERENCIA_FATURA);
    const detail = t.bands.detail[0];
    const tf = detail?.elements[0];
    if (tf?.kind !== 'textField') throw new Error('fixture inesperado');
    tf.expression = '$F{campo_fantasma}';
    const result = validateContract(t);
    expect(result.valid).toBe(false);
    const e = result.messages[0];
    expect(e?.code).toBe('EXPR_UNKNOWN_REF');
    expect(e?.message).toContain('campo_fantasma');
    expect(e?.path).toBe('bands/detail[0]/elements[0]');
  });

  it('escopo de tabela: célula não enxerga fields do master', () => {
    const t: ReportTemplate = clone(REFERENCIA_FATURA);
    const tabela = t.bands.detail[0]?.elements[1];
    if (tabela?.kind !== 'table') throw new Error('fixture inesperado');
    const col0 = tabela.columns[0];
    if (!col0 || 'columns' in col0) throw new Error('esperava coluna simples');
    const cell = col0.detail.elements[0];
    if (cell?.kind !== 'textField') throw new Error('fixture inesperado');
    cell.expression = '$F{cliente_nome}'; // existe no master, não nos itemFields
    const result = validateContract(t);
    expect(result.valid).toBe(false);
    expect(result.messages[0]?.code).toBe('EXPR_UNKNOWN_REF');
    expect(result.messages[0]?.path).toBe('bands/detail[0]/elements[1]/columns[0]/detail/elements[0]');
  });

  it('tabela sobre campo não-collection → INVALID_ATTRIBUTE', () => {
    const t: ReportTemplate = clone(REFERENCIA_FATURA);
    const tabela = t.bands.detail[0]?.elements[1];
    if (tabela?.kind !== 'table') throw new Error('fixture inesperado');
    tabela.datasetField = 'categoria';
    const result = validateContract(t);
    expect(result.valid).toBe(false);
    expect(result.messages.some((m) => m.code === 'INVALID_ATTRIBUTE' && m.message.includes('collection'))).toBe(true);
  });

  it('variável com resetGroup para grupo inexistente → INVALID_ATTRIBUTE', () => {
    const t: ReportTemplate = clone(REFERENCIA_FATURA);
    const v = t.dataContract.variables[1];
    if (!v) throw new Error('fixture inesperado');
    v.resetGroup = 'grupo_fantasma';
    const result = validateContract(t);
    expect(result.valid).toBe(false);
    expect(result.messages[0]?.message).toContain('grupo_fantasma');
    expect(result.messages[0]?.path).toBe('dataContract/variables[1]');
  });

  it('styleRef órfão em elemento e herança de estilo inexistente → INVALID_ATTRIBUTE', () => {
    const t: ReportTemplate = clone(REFERENCIA_FATURA);
    const tf = t.bands.title?.elements[0];
    if (tf?.kind !== 'textField') throw new Error('fixture inesperado');
    tf.styleRef = 'nao_existe';
    const s = t.styles[1];
    if (!s) throw new Error('fixture inesperado');
    s.parentStyleRef = 'pai_fantasma';
    const result = validateContract(t);
    expect(result.valid).toBe(false);
    const msgs = result.messages.map((m) => m.message).join('; ');
    expect(msgs).toContain('nao_existe');
    expect(msgs).toContain('pai_fantasma');
  });

  it('$V desconhecida em conditionalStyle → EXPR_UNKNOWN_REF', () => {
    const t: ReportTemplate = clone(REFERENCIA_FATURA);
    const cs = t.styles[1]?.conditionalStyles?.[0];
    if (!cs) throw new Error('fixture inesperado');
    cs.conditionExpression = '$V{var_fantasma} == 1';
    const result = validateContract(t);
    expect(result.valid).toBe(false);
    expect(result.messages[0]?.code).toBe('EXPR_UNKNOWN_REF');
    expect(result.messages[0]?.path).toBe('styles[1]/conditionalStyles[0]');
  });

  it('variável de grupo built-in ({grupo}_COUNT) é reconhecida', () => {
    const t: ReportTemplate = clone(REFERENCIA_FATURA);
    const footer = t.bands.groups[0]?.footer;
    if (!footer) throw new Error('fixture inesperado');
    footer.elements.push({
      kind: 'textField',
      bounds: { x: 0, y: 0, width: 100, height: 10 },
      expression: '$V{por_categoria_COUNT}',
    });
    expect(validateContract(t).valid).toBe(true);
  });
});
