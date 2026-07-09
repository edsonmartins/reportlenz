import { describe, expect, it } from 'vitest';
import { REFERENCE_TEMPLATES, parseJrxml, serializeJrxml, validateContract, validateSchema } from '../src/index.js';

/**
 * Tarefa phase-0/8.2 — round-trip sobre TODO o conjunto de referência
 * (fatura, comprovante, formulário, etiqueta A4): `serialize(parse(x))`
 * valida e é semanticamente equivalente (cenário 'Round-trip determinístico').
 * O gate G1 (aceito pela Library 7.0.7 real) roda sobre os MESMOS templates
 * no harness Java do CI (emit:fixtures → tools/jr7-harness).
 */
describe('jrxml-core · round-trip do conjunto de referência (8.2)', () => {
  for (const [nome, template] of Object.entries(REFERENCE_TEMPLATES)) {
    describe(`template "${nome}"`, () => {
      const xml = serializeJrxml(template);

      it('serialize → parse reproduz o modelo (equivalência semântica)', () => {
        const result = parseJrxml(xml);
        if (!result.ok) {
          throw new Error(`parse falhou: ${JSON.stringify(result.errors, null, 2)}`);
        }
        expect(result.value).toEqual(template);
      });

      it('round-trip completo é idempotente: serialize(parse(xml)) === xml', () => {
        const reparsed = parseJrxml(xml);
        if (!reparsed.ok) throw new Error('parse falhou');
        expect(serializeJrxml(reparsed.value)).toBe(xml);
      });

      it('passa na validação dupla (validateSchema + validateContract)', () => {
        expect(validateSchema(xml).messages).toEqual([]);
        expect(validateContract(template).messages).toEqual([]);
      });

      it('não contém nenhum marcador Pull ou 6.x (G2/G4)', () => {
        expect(xml).not.toMatch(/<query|queryString|connectionExpression|<reportElement|xmlns/);
      });
    });
  }
});

/**
 * Tarefa phase-0/8.3 — cobertura consolidada dos erros de validação.
 * Os casos exaustivos vivem em parse-forbidden.test.ts e validate.test.ts;
 * aqui fica o resumo executável dos três eixos exigidos pela tarefa.
 */
describe('jrxml-core · cobertura dos erros de validação (8.3)', () => {
  it('Pull → CONTRACT_PULL_FORBIDDEN', () => {
    const r = validateSchema('<jasperReport name="x"><query language="sql"><![CDATA[SELECT 1]]></query></jasperReport>');
    expect(r.valid).toBe(false);
    expect(r.messages[0]?.code).toBe('CONTRACT_PULL_FORBIDDEN');
  });

  it('legado 6.x → LEGACY_DIALECT', () => {
    const r = validateSchema('<jasperReport xmlns="http://jasperreports.sourceforge.net/jasperreports" name="x"/>');
    expect(r.valid).toBe(false);
    expect(r.messages[0]?.code).toBe('LEGACY_DIALECT');
  });

  it('referência órfã → EXPR_UNKNOWN_REF', () => {
    const fatura = REFERENCE_TEMPLATES['fatura'];
    if (!fatura) throw new Error('fixture inesperado');
    const r = validateContract({
      ...fatura,
      bands: {
        detail: [
          {
            height: 20,
            splitType: 'Stretch',
            elements: [{ kind: 'textField', bounds: { x: 0, y: 0, width: 10, height: 10 }, expression: '$F{orfao}' }],
          },
        ],
        groups: [],
      },
    });
    expect(r.valid).toBe(false);
    // Nota: remover os grupos também deixa o resetGroup da variável órfão —
    // o validador acusa ambos; aqui interessa a referência de expressão.
    expect(r.messages.some((m) => m.code === 'EXPR_UNKNOWN_REF' && m.message.includes('orfao'))).toBe(true);
  });
});
