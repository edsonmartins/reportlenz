import { describe, expect, it } from 'vitest';
import { REFERENCIA_FATURA, lerReferenciaDeSubreport, validateContract } from '../src/index.js';
import type { ReportTemplate } from '../src/index.js';

/** ADR-020 (change subreport-por-codename/2.1): literal "repo:<codename>[@n]". */
describe('jrxml-core · subreport por codename publicado', () => {
  it('lê codename e versão fixa do literal', () => {
    expect(lerReferenciaDeSubreport('"repo:fatura_entregas"')).toEqual({ codename: 'fatura_entregas' });
    expect(lerReferenciaDeSubreport(' "repo:cab.padrao-2@3" ')).toEqual({ codename: 'cab.padrao-2', versao: 3 });
  });

  it.each(['$P{sub_template}', '"repo:"', '"repo:x@0"', '"repo:x y"', '"file:/etc/x.jasper"', '"repo:" + $P{c}', 'repo:x'])(
    'recusa %s',
    (expr) => {
      expect(lerReferenciaDeSubreport(expr)).toBeNull();
    },
  );

  it('validateContract aponta SUBREPORT_REF_INVALID para subreport escolhido pelo payload', () => {
    const t = JSON.parse(JSON.stringify(REFERENCIA_FATURA)) as ReportTemplate;
    expect(validateContract(t).messages.filter((m) => m.code === 'SUBREPORT_REF_INVALID')).toHaveLength(0);

    const json = JSON.stringify(t).replace('"\\"repo:fatura_entregas\\""', '"$P{titulo}"');
    const comParametro = JSON.parse(json) as ReportTemplate;
    const msgs = validateContract(comParametro).messages.filter((m) => m.code === 'SUBREPORT_REF_INVALID');
    expect(msgs).toHaveLength(1);
    expect(msgs[0]?.message).toContain('repo:');
  });
});
