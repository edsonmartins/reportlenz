import { describe, expect, it } from 'vitest';
import { REFERENCIA_FATURA, extractContract, parseJrxml, serializeJrxml } from '../src/index.js';

/**
 * Testes da tarefa phase-0/7.1 — cenário do spec: 'Extração de contrato'.
 */
describe('jrxml-core · extractContract (7.1)', () => {
  it('retorna DataContract com fields, parameters e variables declarados', () => {
    const contract = extractContract(REFERENCIA_FATURA);
    expect(contract).toEqual(REFERENCIA_FATURA.dataContract);

    // Variáveis vêm marcadas como calculadas (calculation/resetType) — fora do payload.
    expect(contract.variables.every((v) => v.calculation !== undefined)).toBe(true);

    // Coleção preserva itemFields (vira array de objeto no inputSchema, RFC-002).
    const itens = contract.fields.find((f) => f.name === 'itens');
    expect(itens?.type).toBe('collection');
    expect(itens?.itemFields?.map((f) => f.name)).toEqual(['descricao', 'valor']);
  });

  it('é cópia profunda: mutar o extraído não afeta o template', () => {
    const contract = extractContract(REFERENCIA_FATURA);
    contract.fields.push({ name: 'intruso', type: 'string' });
    const itens = contract.fields.find((f) => f.name === 'itens');
    itens?.itemFields?.push({ name: 'intruso_item', type: 'string' });
    contract.variables[0]!.name = 'renomeada';

    expect(REFERENCIA_FATURA.dataContract.fields.map((f) => f.name)).not.toContain('intruso');
    const itensOriginal = REFERENCIA_FATURA.dataContract.fields.find((f) => f.name === 'itens');
    expect(itensOriginal?.itemFields?.map((f) => f.name)).not.toContain('intruso_item');
    expect(REFERENCIA_FATURA.dataContract.variables[0]?.name).toBe('total_registros');
  });

  it('fecha o ciclo: extração após parse de JRXML serializado', () => {
    const result = parseJrxml(serializeJrxml(REFERENCIA_FATURA));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const contract = extractContract(result.value);
    expect(contract).toEqual(REFERENCIA_FATURA.dataContract);
  });
});
