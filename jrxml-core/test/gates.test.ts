import { describe, expect, it } from 'vitest';
import { avaliarGates } from '../src/publish/gates.js';
import { REFERENCIA_FATURA } from '../src/reference/templates.js';
import type { ReportTemplate } from '../src/model/report.js';

/**
 * Fase 4, bloco 4 — gates de governança G1–G6 (RFC-006 §3): publish só com
 * todos verdes; cada gate acusa com o código/mensagem da tabela da RFC.
 */

/** Clone JSON-safe (o eslint headless do core não conhece structuredClone). */
const clonar = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe('jrxml-core · gates de publish G1–G6 (phase-4/4.1-4.3)', () => {
  it('template de referência passa nos seis gates (verde para publicar)', () => {
    const r = avaliarGates(REFERENCIA_FATURA);
    expect(r.gates.map((g) => `${g.gate}:${g.verde}`)).toEqual([
      'G1:true', 'G2:true', 'G3:true', 'G4:true', 'G5:true', 'G6:true',
    ]);
    expect(r.verde).toBe(true);
    expect(r.jrxmlHash).toMatch(/^[0-9a-f]{64}$/);
    expect(r.inputSchema).not.toBeNull();
    expect(r.jrxml).toContain('<jasperReport');
  });

  it('G3 vermelho: expressão fora do contrato bloqueia (EXPR_UNKNOWN_REF)', () => {
    const t: ReportTemplate = clonar(REFERENCIA_FATURA);
    t.bands.title!.elements.push({
      kind: 'textField',
      bounds: { x: 0, y: 40, width: 100, height: 12 },
      expression: '$F{fantasma}',
    });
    const r = avaliarGates(t);
    expect(r.verde).toBe(false);
    const g3 = r.gates.find((g) => g.gate === 'G3')!;
    expect(g3.verde).toBe(false);
    expect(g3.erros[0]?.code).toBe('EXPR_UNKNOWN_REF');
    // Os demais seguem verdes — o checklist aponta o gate certo.
    expect(r.gates.filter((g) => g.gate !== 'G3').every((g) => g.verde)).toBe(true);
  });

  it('G5 vermelho: contrato vazio = CONTRACT_MISSING (nada de publicar sem contrato)', () => {
    const t: ReportTemplate = clonar(REFERENCIA_FATURA);
    t.dataContract = { fields: [], parameters: [], variables: [] };
    // Zera bindings para isolar o G5 (sem G3 junto).
    t.bands = { detail: [], groups: [] };
    t.styles = REFERENCIA_FATURA.styles;
    const r = avaliarGates(t);
    const g5 = r.gates.find((g) => g.gate === 'G5')!;
    expect(g5.verde).toBe(false);
    expect(g5.erros[0]?.message).toContain('CONTRACT_MISSING');
    expect(r.inputSchema).toBeNull();
  });

  it('G6: consistente quando o hash confere; HASH_MISMATCH quando o conteúdo mudou', () => {
    const base = avaliarGates(REFERENCIA_FATURA);
    expect(avaliarGates(REFERENCIA_FATURA, { hashEsperado: base.jrxmlHash }).verde).toBe(true);

    const mudado: ReportTemplate = clonar(REFERENCIA_FATURA);
    mudado.bands.title!.height += 1;
    const r = avaliarGates(mudado, { hashEsperado: base.jrxmlHash });
    const g6 = r.gates.find((g) => g.gate === 'G6')!;
    expect(g6.verde).toBe(false);
    expect(g6.erros[0]?.message).toContain('HASH_MISMATCH');
    expect(g6.erros[0]?.message).toContain('NOVA versão');
  });

  it('G1 vermelho: modelo que o serializer recusa não passa (aproximação estrutural)', () => {
    const t: ReportTemplate = clonar(REFERENCIA_FATURA);
    (t.bands.title!.elements[0] as { kind: string }).kind = 'inexistente';
    const r = avaliarGates(t);
    const g1 = r.gates.find((g) => g.gate === 'G1')!;
    expect(g1.verde).toBe(false);
    expect(r.verde).toBe(false);
    expect(r.jrxml).toBe('');
  });
});
