/**
 * Biblioteca de blocos reutilizáveis (Fase 3, tarefa 8.1 — RFC-004 §8).
 *
 * Um bloco é um conjunto de elementos prontos + o MINI-CONTRATO que eles
 * exigem (fields/params/variables). Inserir um bloco mescla o mini-contrato
 * ao contrato do template (tarefa 8.2) e cola os elementos na banda de
 * destino — o documento continua passando pelos gates (G3) sem edição manual.
 */
import type { Element, FieldDecl, ParamDecl, VariableDecl } from '@reportlenz/jrxml-core';
import { mmParaPt } from '../canvas/geometria';
import type { SecaoUnica } from '../store/documentoStore';

/** O que o bloco EXIGE do contrato do template (subconjunto de DataContract). */
export interface MiniContrato {
  fields?: FieldDecl[];
  parameters?: ParamDecl[];
  variables?: VariableDecl[];
}

export interface BlocoReutilizavel {
  id: string;
  /**
   * Versão do bloco (Fase 4, tarefa 6.1 — RFC-006 §5): blocos são artefatos
   * versionados e referenciáveis; a inserção CARIMBA `reportlenz.bloco.<id>`
   * = versão nas properties do template (proveniência auditável no JRXML).
   * Mudança de elementos ou de mini-contrato ⇒ incrementar.
   */
  versao: number;
  rotulo: string;
  /** Auto-explicação pt-BR (tooltip — RFC-004 §9). */
  descricao: string;
  /** Banda de destino: seção única (criada se não existir) ou 1ª detail. */
  destino: SecaoUnica | 'detail';
  /** Altura mínima da banda de destino (estica, nunca encolhe). */
  alturaMinimaPt: number;
  elementos: Element[];
  miniContrato: MiniContrato;
}

const pt = (mm: number) => Math.round(mmParaPt(mm));

export const BIBLIOTECA_DE_BLOCOS: BlocoReutilizavel[] = [
  {
    id: 'cabecalho-timbrado',
    versao: 1,
    rotulo: 'Cabeçalho timbrado',
    descricao: 'Logotipo + razão social + CNPJ no pageHeader, com linha separadora. Dados via parâmetros.',
    destino: 'pageHeader',
    alturaMinimaPt: 64,
    elementos: [
      { kind: 'image', bounds: { x: 0, y: 4, width: 48, height: 48 }, expression: '$P{empresa_logo}', scaleImage: 'RetainShape', onErrorType: 'Blank' },
      { kind: 'textField', bounds: { x: 56, y: 8, width: 320, height: 20 }, expression: '$P{empresa_nome}', style: { bold: true, fontSize: 14 } },
      { kind: 'textField', bounds: { x: 56, y: 30, width: 320, height: 14 }, expression: '"CNPJ: " + $P{empresa_cnpj}', style: { fontSize: 9 } },
      { kind: 'line', bounds: { x: 0, y: 58, width: 520, height: 1 }, pen: { lineWidth: 0.5 } },
    ],
    miniContrato: {
      parameters: [
        { name: 'empresa_nome', type: 'string', required: true, description: 'Razão social exibida no timbre' },
        { name: 'empresa_cnpj', type: 'string', description: 'CNPJ exibido sob a razão social' },
        { name: 'empresa_logo', type: 'string', description: 'URL ou caminho da imagem do logotipo' },
      ],
    },
  },
  {
    id: 'rodape-com-totais',
    versao: 1,
    rotulo: 'Rodapé com totais',
    descricao: 'Total geral (soma de $F{valor}) no summary, formatado como R$. Cria a variável de soma.',
    destino: 'summary',
    alturaMinimaPt: 44,
    elementos: [
      { kind: 'line', bounds: { x: 0, y: 2, width: 520, height: 1 }, pen: { lineWidth: 0.5 } },
      { kind: 'staticText', bounds: { x: 290, y: 12, width: 110, height: 16 }, text: 'Total geral', style: { bold: true, hAlign: 'Right' } },
      { kind: 'textField', bounds: { x: 404, y: 12, width: 116, height: 16 }, expression: '$V{total_geral}', pattern: '¤ #,##0.00', blankWhenNull: true, style: { bold: true, hAlign: 'Right' } },
    ],
    miniContrato: {
      fields: [{ name: 'valor', type: 'decimal', description: 'Valor somado no total geral' }],
      variables: [
        { name: 'total_geral', type: 'decimal', calculation: 'Sum', expression: '$F{valor}', resetType: 'Report' },
      ],
    },
  },
  {
    id: 'bloco-assinatura',
    versao: 1,
    rotulo: 'Bloco de assinatura',
    descricao: 'Linha de assinatura com nome e cargo (parâmetros), centralizados no summary.',
    destino: 'summary',
    alturaMinimaPt: 72,
    elementos: [
      { kind: 'line', bounds: { x: 140, y: 40, width: 240, height: 1 }, pen: { lineWidth: 0.5 } },
      { kind: 'textField', bounds: { x: 140, y: 44, width: 240, height: 14 }, expression: '$P{assinante_nome}', style: { hAlign: 'Center' } },
      { kind: 'textField', bounds: { x: 140, y: 58, width: 240, height: 12 }, expression: '$P{assinante_cargo}', blankWhenNull: true, style: { hAlign: 'Center', fontSize: 8 } },
    ],
    miniContrato: {
      parameters: [
        { name: 'assinante_nome', type: 'string', required: true, description: 'Nome sob a linha de assinatura' },
        { name: 'assinante_cargo', type: 'string', description: 'Cargo/função do assinante' },
      ],
    },
  },
  {
    id: 'qr-de-pedido',
    versao: 1,
    rotulo: 'QR de pedido',
    descricao: 'QR Code de 25mm bindado a $F{pedido.qrPayload} (URL de consulta, chave Pix etc.).',
    destino: 'detail',
    alturaMinimaPt: pt(25) + 8,
    elementos: [
      { kind: 'barcode', bounds: { x: 0, y: 4, width: pt(25), height: pt(25) }, barcodeType: 'QRCode', expression: '$F{pedido.qrPayload}' },
    ],
    miniContrato: {
      fields: [{ name: 'pedido.qrPayload', type: 'string', description: 'Conteúdo codificado no QR (URL/chave)' }],
    },
  },
];
