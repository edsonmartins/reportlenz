import { describe, expect, it } from 'vitest';
import type { DataContract } from '../src/index.js';
import { REFERENCIA_COMPROVANTE, buildInputSchema, extractContract } from '../src/index.js';

/**
 * Testes das tarefas phase-1/3.1 (buildInputSchema) e 3.2 (heurística de
 * agrupamento). O caso central reproduz o exemplo canônico da RFC-002 §2.
 */

/** Contrato do comprovante de entrega exatamente como no exemplo da RFC-002. */
const CONTRATO_RFC002: DataContract = {
  fields: [
    { name: 'pedido.numero', type: 'string', required: true },
    { name: 'pedido.data', type: 'date', required: true },
    { name: 'pedido.qrPayload', type: 'string', required: true },
    { name: 'cliente.nome', type: 'string', required: true },
    { name: 'cliente.documento', type: 'string', required: true },
    { name: 'cliente.endereco', type: 'string' },
    {
      name: 'itens',
      type: 'collection',
      required: true,
      itemFields: [
        { name: 'descricao', type: 'string', required: true },
        { name: 'quantidade', type: 'decimal', required: true },
        { name: 'unidade', type: 'string' },
      ],
    },
  ],
  parameters: [],
  variables: [
    { name: 'total_itens', type: 'integer', calculation: 'Count', expression: '$F{itens}' },
  ],
};

describe('jrxml-core · buildInputSchema (3.1/3.2, RFC-002)', () => {
  it('reproduz o exemplo canônico da RFC-002 §2 (comprovante de entrega)', () => {
    const schema = buildInputSchema(CONTRATO_RFC002, { templateName: 'comprovante-entrega-rq', version: 3 });

    expect(schema).toEqual({
      $schema: 'https://json-schema.org/draft/2020-12/schema',
      $id: 'reportlenz:contract:comprovante-entrega-rq:v3',
      type: 'object',
      required: ['pedido', 'cliente', 'itens'],
      properties: {
        pedido: {
          type: 'object',
          required: ['numero', 'data', 'qrPayload'],
          properties: {
            numero: { type: 'string' },
            data: { type: 'string', format: 'date' },
            qrPayload: { type: 'string' },
          },
        },
        cliente: {
          type: 'object',
          required: ['nome', 'documento'],
          properties: {
            nome: { type: 'string' },
            documento: { type: 'string' },
            endereco: { type: 'string' },
          },
        },
        itens: {
          type: 'array',
          items: {
            type: 'object',
            required: ['descricao', 'quantidade'],
            properties: {
              descricao: { type: 'string' },
              quantidade: { type: 'number' },
              unidade: { type: 'string' },
            },
          },
        },
      },
    });
  });

  it('cenário do spec: variable calculada NÃO aparece no payload', () => {
    const schema = buildInputSchema(CONTRATO_RFC002);
    expect(JSON.stringify(schema)).not.toContain('total_itens');
  });

  it('cenário do spec: campos consumidos em detail/tabela viram array de objeto', () => {
    const schema = buildInputSchema(CONTRATO_RFC002);
    expect(schema.properties?.['itens']?.type).toBe('array');
    expect(schema.properties?.['itens']?.items?.type).toBe('object');
  });

  it('parameters viram propriedades de topo do MESMO payload', () => {
    const contrato: DataContract = {
      fields: [{ name: 'cliente.nome', type: 'string', required: true }],
      parameters: [{ name: 'titulo', type: 'string', required: true, description: 'Título do relatório' }],
      variables: [],
    };
    const schema = buildInputSchema(contrato);
    expect(schema.properties?.['titulo']).toEqual({ type: 'string', description: 'Título do relatório' });
    expect(schema.required).toEqual(['titulo', 'cliente']);
  });

  it('fecha o ciclo com o template de referência: extractContract → inputSchema agrupado', () => {
    const schema = buildInputSchema(extractContract(REFERENCIA_COMPROVANTE), {
      templateName: 'comprovante_entrega',
      version: 1,
    });
    expect(schema.$id).toBe('reportlenz:contract:comprovante_entrega:v1');
    expect(schema.properties?.['pedido']?.type).toBe('object');
    expect(Object.keys(schema.properties?.['pedido']?.properties ?? {})).toEqual(['numero', 'data', 'qrPayload']);
    expect(schema.properties?.['cliente']?.type).toBe('object');
    expect(schema.properties?.['itens']?.type).toBe('array');
    // Sem required: o JRXML não carrega obrigatoriedade (vem da UI/publish, ADR-009)
    expect(schema.required).toBeUndefined();
    // Anti-Pull por construção: nada de query/conexão em nenhum lugar
    expect(JSON.stringify(schema)).not.toMatch(/query|sql|jdbc|connection/i);
  });

  it('recusa contrato com conflito de agrupamento (escalar que é prefixo)', () => {
    const conflito: DataContract = {
      fields: [
        { name: 'cliente', type: 'string' },
        { name: 'cliente.nome', type: 'string' },
      ],
      parameters: [],
      variables: [],
    };
    expect(() => buildInputSchema(conflito)).toThrow(/conflito de agrupamento/);
  });
});
