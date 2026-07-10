/**
 * Presets de inserção de elementos (Fase 3, bloco 3 + pendência da paleta).
 *
 * Perfis de barcode pt-BR (tarefa 3.2) com dimensões dos padrões:
 * - Boleto bancário: ITF-25 (Interleaved 2 of 5), ~103×13mm (FEBRABAN);
 * - DANFE (chave de acesso NF-e, 44 dígitos): CODE-128C, ~80×12mm (SEFAZ);
 * - QR (NFC-e/Pix): quadrado ~25mm.
 * As expressões nascem com amostras literais VÁLIDAS — troque por `$F{...}`
 * no expression editor.
 */
import type { Element } from '@reportlenz/jrxml-core';
import { mmParaPt } from '../canvas/geometria';

export interface PresetDeElemento {
  grupo: 'básicos' | 'barcode';
  rotulo: string;
  criar: () => Element;
}

const pt = (mm: number) => Math.round(mmParaPt(mm));

export const PRESETS_DE_ELEMENTO: PresetDeElemento[] = [
  {
    grupo: 'básicos',
    rotulo: 'Texto fixo',
    criar: () => ({ kind: 'staticText', bounds: { x: 5, y: 5, width: 120, height: 16 }, text: 'Texto' }),
  },
  {
    grupo: 'básicos',
    rotulo: 'Campo (expressão)',
    criar: () => ({ kind: 'textField', bounds: { x: 5, y: 5, width: 160, height: 16 }, expression: '""' }),
  },
  {
    grupo: 'básicos',
    rotulo: 'Linha',
    criar: () => ({ kind: 'line', bounds: { x: 5, y: 5, width: 200, height: 1 }, pen: { lineWidth: 0.5 } }),
  },
  {
    grupo: 'básicos',
    rotulo: 'Retângulo',
    criar: () => ({ kind: 'rectangle', bounds: { x: 5, y: 5, width: 120, height: 40 }, pen: { lineWidth: 0.5 } }),
  },
  {
    grupo: 'básicos',
    rotulo: 'Imagem',
    criar: () => ({ kind: 'image', bounds: { x: 5, y: 5, width: 80, height: 40 }, expression: '""', scaleImage: 'RetainShape' }),
  },
  {
    grupo: 'básicos',
    rotulo: 'Sub-relatório',
    // Contrato do filho via parâmetros; datasource sobre coleção do contrato (ajuste no painel).
    criar: () => ({
      kind: 'subreport',
      bounds: { x: 5, y: 5, width: 300, height: 30 },
      templateExpression: '$P{sub_template}',
      parameters: [],
    }),
  },
  {
    grupo: 'barcode',
    rotulo: 'Code128',
    criar: () => ({
      kind: 'barcode',
      bounds: { x: 5, y: 5, width: pt(60), height: pt(12) },
      barcodeType: 'Code128',
      expression: '"REPORTLENZ-0001"',
    }),
  },
  {
    grupo: 'barcode',
    rotulo: 'QR Code (NFC-e/Pix)',
    criar: () => ({
      kind: 'barcode',
      bounds: { x: 5, y: 5, width: pt(25), height: pt(25) },
      barcodeType: 'QRCode',
      expression: '"https://exemplo.com/pedido/123"',
    }),
  },
  {
    grupo: 'barcode',
    rotulo: 'Boleto bancário (ITF-25)',
    criar: () => ({
      kind: 'barcode',
      bounds: { x: 5, y: 5, width: pt(103), height: pt(13) },
      barcodeType: 'Interleaved2Of5',
      // 44 dígitos (comprimento PAR, exigência do ITF) — amostra FEBRABAN.
      expression: '"03399876543210987654321098765432109876543210"',
    }),
  },
  {
    grupo: 'barcode',
    rotulo: 'DANFE — chave NF-e (Code128)',
    criar: () => ({
      kind: 'barcode',
      bounds: { x: 5, y: 5, width: pt(80), height: pt(12) },
      barcodeType: 'Code128',
      // Chave de acesso de 44 dígitos (amostra).
      expression: '"35200114200166000187550010000000046550000000"',
    }),
  },
];
