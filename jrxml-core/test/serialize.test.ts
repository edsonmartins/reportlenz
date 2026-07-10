import { describe, expect, it } from 'vitest';
import type { ReportTemplate } from '../src/index.js';
import { parseJrxml, serializeJrxml } from '../src/index.js';
import { REFERENCIA_FATURA } from '../src/reference/templates.js';

/**
 * Testes do serializer (phase-0/5.1). O round-trip TS (parse ∘ serialize)
 * verifica equivalência semântica; a aceitação pela Library real é o harness
 * Java da tarefa 5.2 (ADR-013).
 *
 * Nota: `FieldDecl.required` não tem representação em JRXML — vive no
 * inputSchema persistido à parte (ADR-009/RFC-002) — e por isso não aparece
 * no template de referência.
 */
describe('jrxml-core · serializeJrxml (5.1)', () => {
  it('round-trip TS: parse(serialize(t)) é semanticamente equivalente a t', () => {
    const xml = serializeJrxml(REFERENCIA_FATURA);
    const result = parseJrxml(xml);
    if (!result.ok) {
      throw new Error('parse falhou: ' + JSON.stringify(result.errors, null, 2));
    }
    expect(result.value).toEqual(REFERENCIA_FATURA);
  });

  it('é determinístico: mesmo modelo → mesmo XML byte a byte', () => {
    expect(serializeJrxml(REFERENCIA_FATURA)).toBe(serializeJrxml(REFERENCIA_FATURA));
  });

  it('nunca emite query/queryString (anti-Pull por construção, G2)', () => {
    const xml = serializeJrxml(REFERENCIA_FATURA);
    expect(xml).not.toContain('<query');
    expect(xml).not.toContain('queryString');
    expect(xml).not.toContain('connectionExpression');
  });

  it('emite o dialeto 7: element kind, raiz sem namespace, tabela via component', () => {
    const xml = serializeJrxml(REFERENCIA_FATURA);
    expect(xml).toContain('<jasperReport name="fatura_completa"');
    expect(xml).not.toContain('xmlns');
    expect(xml).not.toContain('<reportElement');
    expect(xml).toContain('<element kind="staticText"');
    expect(xml).toContain('<component kind="table">');
    expect(xml).toContain('<component kind="barcode4j:QRCode">');
    expect(xml).toContain('subDataset="itens_ds"');
    expect(xml).toContain('<dataset name="itens_ds">');
  });

  it('recusa elemento de runtime com kind desconhecido (nada some em silêncio)', () => {
    const t: ReportTemplate = {
      ...REFERENCIA_FATURA,
      bands: {
        detail: [
          {
            height: 20,
            splitType: 'Stretch',
            // @ts-expect-error — estado deliberadamente corrompido (sem kind)
            elements: [{ bounds: { x: 0, y: 0, width: 1, height: 1 } }],
          },
        ],
        groups: [],
      },
    };
    expect(() => serializeJrxml(t)).toThrow(/kind desconhecido/);
  });

  it('escapa atributos e protege CDATA contra ]]>', () => {
    const t: ReportTemplate = {
      ...REFERENCIA_FATURA,
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
