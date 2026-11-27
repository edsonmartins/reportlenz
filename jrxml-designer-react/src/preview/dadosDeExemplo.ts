/**
 * Dados de exemplo para o preview (tarefa phase-2/5.2): gera um payload que
 * SATISFAZ o contrato (formato aninhado do inputSchema — nomes pontuados
 * viram objeto; coleções viram array com 2 itens de amostra).
 *
 * Campos string que alimentam DIRETAMENTE um código de barras recebem valor
 * válido para a simbologia (EAN com dígito verificador, I2of5 com nº par de
 * dígitos, Code39 em maiúsculas) — "ean exemplo" fazia o engine recusar o
 * render (barcode4j: "Valid are 0-9 only").
 */
import type { BarcodeType, DataContract, FieldDecl, ReportTemplate, ScalarType } from '@reportlenz/jrxml-core';
import { CENARIOS, REFERENCE_TEMPLATES } from '@reportlenz/jrxml-core';

/** Campo (nome como aparece em $F{}/$P{}) → simbologia que ele alimenta. */
export type CamposDeCodigoDeBarras = Record<string, BarcodeType>;

const REFERENCIA_SIMPLES = /^\s*\$[FP]\{([^}]+)\}\s*$/;

/**
 * Varre o template (bandas, frames, células de tabela, grupos — qualquer
 * profundidade) e mapeia os campos usados como conteúdo de barcode.
 * Expressões compostas ficam de fora: o valor não é derivável do campo.
 */
export function camposDeCodigoDeBarras(template: unknown): CamposDeCodigoDeBarras {
  const mapa: CamposDeCodigoDeBarras = {};
  const visitar = (no: unknown): void => {
    if (Array.isArray(no)) {
      no.forEach(visitar);
      return;
    }
    if (typeof no !== 'object' || no === null) return;
    const objeto = no as Record<string, unknown>;
    if (objeto.kind === 'barcode' && typeof objeto.expression === 'string' && typeof objeto.barcodeType === 'string') {
      const casamento = REFERENCIA_SIMPLES.exec(objeto.expression);
      if (casamento?.[1]) mapa[casamento[1]] = objeto.barcodeType as BarcodeType;
    }
    Object.values(objeto).forEach(visitar);
  };
  visitar(template);
  return mapa;
}

/** Dígito verificador GS1 (EAN-13/EAN-8): pesos 3,1,3… a partir da DIREITA. */
export function digitoVerificadorEan(semDigito: string): string {
  let soma = 0;
  for (let i = 0; i < semDigito.length; i++) {
    soma += Number(semDigito[semDigito.length - 1 - i]) * (i % 2 === 0 ? 3 : 1);
  }
  return String((10 - (soma % 10)) % 10);
}

/** Valor de amostra válido para a simbologia; `indice` varia os itens. */
export function valorDeCodigoDeBarras(tipo: BarcodeType, nome: string, indice = 0): string {
  const sequencia = String(indice + 1).padStart(3, '0');
  switch (tipo) {
    case 'EAN13': {
      const base = `789000000${sequencia}`; // prefixo 789 (Brasil) + 12 dígitos
      return base + digitoVerificadorEan(base);
    }
    case 'EAN8': {
      const base = `7890${sequencia}`; // 7 dígitos
      return base + digitoVerificadorEan(base);
    }
    case 'Interleaved2Of5':
      return `1234${sequencia}0`.padEnd(8, '0'); // nº PAR de dígitos
    case 'Code39':
      return `${nome}-${sequencia}`.toUpperCase().replace(/[^A-Z0-9 .$/+%-]/g, '-');
    default:
      // Code128, QR, DataMatrix, PDF417 aceitam texto livre.
      return indice > 0 ? `${nome} exemplo ${indice + 1}` : `${nome} exemplo`;
  }
}

function valorDeExemplo(tipo: ScalarType, nome: string, indice = 0, codigo?: BarcodeType): unknown {
  switch (tipo) {
    case 'string':
      if (codigo) return valorDeCodigoDeBarras(codigo, nome, indice);
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

function valorDeField(f: FieldDecl, codigos: CamposDeCodigoDeBarras, indice = 0, itens = 2): unknown {
  if (f.type === 'collection') {
    return Array.from({ length: itens }, (_, i) => {
      const item: Record<string, unknown> = {};
      for (const sub of f.itemFields ?? []) {
        inserirAninhado(item, sub.name, valorDeField(sub, codigos, i));
      }
      return item;
    });
  }
  return valorDeExemplo(f.type, f.name.split('.').pop() ?? f.name, indice, codigos[f.name]);
}

export interface OpcoesDeExemplo {
  /**
   * Coleção-datasource da grade (ADR-015): ganha 9 itens de amostra para o
   * preview mostrar a GRADE de verdade (3×3 numa folha A4 típica).
   */
  datasourceCampo?: string;
  /** Campos que alimentam barcodes (ver `camposDeCodigoDeBarras`). */
  codigosDeBarras?: CamposDeCodigoDeBarras;
}

/** Payload de amostra que satisfaz o contrato (validável pelo inputSchema). */
export function gerarDadosDeExemplo(contrato: DataContract, opcoes: OpcoesDeExemplo = {}): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  const codigos = opcoes.codigosDeBarras ?? {};
  for (const p of contrato.parameters) {
    inserirAninhado(payload, p.name, valorDeExemplo(p.type, p.name.split('.').pop() ?? p.name, 0, codigos[p.name]));
  }
  for (const f of contrato.fields) {
    const itens = f.name === opcoes.datasourceCampo ? 9 : 2;
    inserirAninhado(payload, f.name, valorDeField(f, codigos, 0, itens));
  }
  return payload;
}

/**
 * Dados REALISTAS para o preview de um modelo do catálogo (ADR-022): enquanto
 * o contrato do documento for o do modelo de referência de mesmo nome, o
 * preview usa o cenário "tipico" do jrxml-core — o DANFE sai com chave válida,
 * o boleto com linha digitável de verdade. Contrato alterado → undefined (o
 * chamador volta aos dados genéricos, que sempre satisfazem o contrato).
 */
export function dadosDoCatalogo(template: ReportTemplate): Record<string, unknown> | undefined {
  for (const [chave, referencia] of Object.entries(REFERENCE_TEMPLATES)) {
    if (referencia.name !== template.name) continue;
    if (JSON.stringify(referencia.dataContract) !== JSON.stringify(template.dataContract)) return undefined;
    const tipico = CENARIOS[chave]?.find((c) => c.nome === 'tipico');
    return tipico ? (JSON.parse(JSON.stringify(tipico.payload)) as Record<string, unknown>) : undefined;
  }
  return undefined;
}
