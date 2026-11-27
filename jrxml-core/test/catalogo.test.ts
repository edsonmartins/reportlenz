import { describe, expect, it } from 'vitest';
import type { JsonSchema } from '../src/contract/buildInputSchema.js';
import { buildInputSchema } from '../src/contract/buildInputSchema.js';
import { extractContract } from '../src/extract/extractContract.js';
import type { Element } from '../src/model/elements.js';
import type { ReportTemplate } from '../src/model/report.js';
import { avaliarGates } from '../src/publish/gates.js';
import { CENARIOS, boletoDeExemplo, chaveNfeDeExemplo, moeda } from '../src/reference/cenarios.js';
import type { FormatoDeCodigo } from '../src/reference/cenarios.js';
import { REFERENCE_TEMPLATES } from '../src/reference/templates.js';

/**
 * Matriz do core (ADR-022, change variacoes-de-templates/2.5): percorre o
 * catálogo INTEIRO — nenhum teste por modelo. Round-trip e validação dupla
 * já percorrem o catálogo em roundtrip.test.ts; aqui: gates G1–G6, cenários
 * declarados e payload × inputSchema.
 */

/** Validador do subconjunto de JSON Schema que o buildInputSchema emite. */
function violacoes(schema: JsonSchema, valor: unknown, caminho = '$'): string[] {
  if (valor === null) return [`${caminho}: null não é aceito pelo schema (omita a chave)`];
  switch (schema.type) {
    case 'object': {
      if (typeof valor !== 'object' || Array.isArray(valor)) return [`${caminho}: esperado objeto`];
      const obj = valor as Record<string, unknown>;
      const props = schema.properties ?? {};
      // Coleção opaca (itens sem campos declarados, ex.: entregas da fatura): aceita qualquer chave.
      const aberto = Object.keys(props).length === 0;
      const erros = (schema.required ?? []).filter((r) => !(r in obj)).map((r) => `${caminho}.${r}: obrigatório`);
      for (const [chave, v] of Object.entries(obj)) {
        const sub = props[chave];
        // Mais estrito que o JSON Schema (que aceita extras): chave fora do
        // contrato num cenário é quase sempre erro de digitação no cenário.
        if (!sub) {
          if (!aberto) erros.push(`${caminho}.${chave}: fora do contrato`);
        } else erros.push(...violacoes(sub, v, `${caminho}.${chave}`));
      }
      return erros;
    }
    case 'array':
      if (!Array.isArray(valor)) return [`${caminho}: esperado array`];
      return schema.items ? valor.flatMap((item, i) => violacoes(schema.items!, item, `${caminho}[${i}]`)) : [];
    case 'string':
      if (typeof valor !== 'string') return [`${caminho}: esperado string`];
      if (schema.format === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return [`${caminho}: data fora de AAAA-MM-DD`];
      return [];
    case 'number':
      return typeof valor === 'number' ? [] : [`${caminho}: esperado número`];
    case 'integer':
      return Number.isInteger(valor) ? [] : [`${caminho}: esperado inteiro`];
    case 'boolean':
      return typeof valor === 'boolean' ? [] : [`${caminho}: esperado booleano`];
  }
}

const SIMBOLOGIA: Record<FormatoDeCodigo, string> = { QR_CODE: 'QRCode', CODE_128: 'Code128', ITF: 'Interleaved2Of5', EAN_13: 'EAN13' };

function barcodes(template: ReportTemplate): Array<Extract<Element, { kind: 'barcode' }>> {
  const achados: Array<Extract<Element, { kind: 'barcode' }>> = [];
  const visitar = (no: unknown): void => {
    if (Array.isArray(no)) return no.forEach(visitar);
    if (typeof no !== 'object' || no === null) return;
    const o = no as Record<string, unknown>;
    if (o['kind'] === 'barcode') achados.push(o as unknown as Extract<Element, { kind: 'barcode' }>);
    Object.values(o).forEach(visitar);
  };
  visitar(template.bands);
  return achados;
}

const ehSubreport = (t: ReportTemplate) => t.properties['reportlenz.template.tipo'] === 'subreport';

describe('jrxml-core · matriz do catálogo (ADR-022)', () => {
  it('o catálogo tem os 15 modelos (14 da galeria + o subreport da fatura)', () => {
    expect(Object.keys(REFERENCE_TEMPLATES)).toHaveLength(15);
    expect(Object.keys(CENARIOS).sort()).toEqual(Object.keys(REFERENCE_TEMPLATES).sort());
  });

  for (const [chave, template] of Object.entries(REFERENCE_TEMPLATES)) {
    describe(`modelo "${chave}"`, () => {
      const cenarios = CENARIOS[chave] ?? [];

      it('passa nos gates G1–G6', () => {
        const r = avaliarGates(template);
        expect(r.gates.filter((g) => !g.verde).map((g) => `${g.gate}: ${JSON.stringify(g.erros)}`)).toEqual([]);
      });

      if (ehSubreport(template)) {
        it('subreport não tem cenário próprio (é exercitado pelo pai)', () => expect(cenarios).toEqual([]));
        return;
      }

      it('declara ao menos os cenários "tipico" e "minimo", sem nomes repetidos', () => {
        const nomes = cenarios.map((c) => c.nome);
        expect(nomes).toEqual(expect.arrayContaining(['tipico', 'minimo']));
        expect(new Set(nomes).size).toBe(nomes.length);
      });

      const schema = buildInputSchema(extractContract(template));
      for (const cenario of cenarios) {
        it(`cenário "${cenario.nome}" satisfaz o inputSchema`, () => {
          expect(violacoes(schema, cenario.payload)).toEqual([]);
        });
      }

      it('todo código de barras esperado corresponde a uma simbologia do modelo', () => {
        const tipos = new Set(barcodes(template).map((b) => b.barcodeType));
        for (const c of cenarios.flatMap((x) => x.espera.codigos ?? [])) {
          expect(tipos, `${c.formato} ausente do modelo`).toContain(SIMBOLOGIA[c.formato]);
        }
      });
    });
  }

  it('Scenario "Cálculos ficam a montante": boleto e DANFE desenham o que recebem', () => {
    const boleto = barcodes(REFERENCE_TEMPLATES['boleto']!);
    expect(boleto.map((b) => [b.barcodeType, b.expression])).toEqual([['Interleaved2Of5', '$F{codigo_barras}']]);
    const danfe = barcodes(REFERENCE_TEMPLATES['danfe']!);
    expect(danfe.map((b) => [b.barcodeType, b.expression])).toEqual([['Code128', '$F{chave_acesso}']]);
  });
});

describe('jrxml-core · geradores de dados dos cenários (o que o backend de domínio faria)', () => {
  it('boleto: 44 posições, DV geral módulo 11 na 5ª e linha digitável de 47 dígitos', () => {
    const { codigo, linha } = boletoDeExemplo('341', '2026-12-10', 1234.56, '1090000012345678901234567');
    expect(codigo).toMatch(/^\d{44}$/);
    expect(codigo.slice(0, 4)).toBe('3419');
    expect(codigo.slice(9, 19)).toBe('0000123456');
    expect(linha.replace(/\D/g, '')).toHaveLength(47);
    // Exemplo verificável à mão: fator do ciclo 2025 (22/02/2025 = 1000) + 656 dias até 10/12/2026.
    expect(codigo.slice(5, 9)).toBe('1656');
    expect(linha.endsWith(` ${codigo[4]} 16560000123456`)).toBe(true);
  });

  it('chave NF-e: 44 dígitos, modelo 55 e DV módulo 11', () => {
    const chave = chaveNfeDeExemplo('35', '2611', '12345678000199', 1, 4567, '12345678');
    expect(chave).toMatch(/^\d{44}$/);
    expect(chave.slice(20, 22)).toBe('55');
    // Reconferência independente do DV.
    let soma = 0;
    let peso = 2;
    for (let i = 42; i >= 0; i--) {
      soma += Number(chave[i]) * peso;
      peso = peso === 9 ? 2 : peso + 1;
    }
    const resto = soma % 11;
    expect(Number(chave[43])).toBe(resto < 2 ? 0 : 11 - resto);
  });

  it('moeda formata como o pattern ¤ #,##0.00 em pt-BR', () => {
    expect(moeda(1234.5)).toBe('R$ 1.234,50');
    expect(moeda(0)).toBe('R$ 0,00');
    expect(moeda(-40.25)).toBe('-R$ 40,25');
  });
});
