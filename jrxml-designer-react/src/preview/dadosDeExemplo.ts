/**
 * Dados de exemplo para o preview (tarefa phase-2/5.2): gera um payload que
 * SATISFAZ o contrato (formato aninhado do inputSchema — nomes pontuados
 * viram objeto; coleções viram array com 2 itens de amostra).
 */
import type { DataContract, FieldDecl, ScalarType } from '@reportlenz/jrxml-core';

function valorDeExemplo(tipo: ScalarType, nome: string, indice = 0): unknown {
  switch (tipo) {
    case 'string':
      return indice > 0 ? `${nome} exemplo ${indice + 1}` : `${nome} exemplo`;
    case 'integer':
      return 10 + indice;
    case 'decimal':
      return 123.45 + indice;
    case 'boolean':
      return true;
    case 'date':
      return '2026-01-15';
    case 'datetime':
      return '2026-01-15T10:30:00';
  }
}

function inserirAninhado(destino: Record<string, unknown>, caminho: string, valor: unknown): void {
  const partes = caminho.split('.');
  let atual = destino;
  for (let i = 0; i < partes.length - 1; i++) {
    const parte = partes[i]!;
    const existente = atual[parte];
    if (typeof existente !== 'object' || existente === null || Array.isArray(existente)) {
      atual[parte] = {};
    }
    atual = atual[parte] as Record<string, unknown>;
  }
  atual[partes[partes.length - 1]!] = valor;
}

function valorDeField(f: FieldDecl, indice = 0, itens = 2): unknown {
  if (f.type === 'collection') {
    return Array.from({ length: itens }, (_, i) => {
      const item: Record<string, unknown> = {};
      for (const sub of f.itemFields ?? []) {
        inserirAninhado(item, sub.name, valorDeField(sub, i));
      }
      return item;
    });
  }
  return valorDeExemplo(f.type, f.name.split('.').pop() ?? f.name, indice);
}

export interface OpcoesDeExemplo {
  /**
   * Coleção-datasource da grade (ADR-015): ganha 9 itens de amostra para o
   * preview mostrar a GRADE de verdade (3×3 numa folha A4 típica).
   */
  datasourceCampo?: string;
}

/** Payload de amostra que satisfaz o contrato (validável pelo inputSchema). */
export function gerarDadosDeExemplo(contrato: DataContract, opcoes: OpcoesDeExemplo = {}): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const p of contrato.parameters) {
    inserirAninhado(payload, p.name, valorDeExemplo(p.type, p.name.split('.').pop() ?? p.name));
  }
  for (const f of contrato.fields) {
    const itens = f.name === opcoes.datasourceCampo ? 9 : 2;
    inserirAninhado(payload, f.name, valorDeField(f, 0, itens));
  }
  return payload;
}
