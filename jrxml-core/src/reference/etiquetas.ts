/**
 * Etiquetas e crachás em grade A4 laser (ADR-022, tarefa
 * variacoes-de-templates/2.3; grade multi-registro do ADR-015 — um item da
 * coleção = uma etiqueta). Térmica continua fora de escopo (ADR-011).
 */
import type { ReportTemplate } from '../model/report.js';
import { NEGRITO, a4Grade, campo, moldura, texto } from './comum.js';

const AZUL = '#1565C0';

/** Etiqueta de produto com QR — 4 colunas (135pt), 8 linhas por folha. */
export const REFERENCIA_ETIQUETA_PRODUTO_QR: ReportTemplate = {
  name: 'etiqueta_produto_qr',
  pageFormat: a4Grade(4, 5),
  properties: {
    'reportlenz.datasource.campo': 'produtos',
    'reportlenz.template.tipo': 'etiqueta_a4',
  },
  styles: [{ name: 'base', isDefault: true, fontName: 'DejaVu Sans', fontSize: 7 }],
  dataContract: {
    fields: [
      {
        name: 'produtos',
        type: 'collection',
        itemFields: [
          { name: 'nome', type: 'string' },
          { name: 'sku', type: 'string' },
          { name: 'preco', type: 'decimal' },
          { name: 'lote', type: 'string' },
          { name: 'qr', type: 'string' },
        ],
      },
    ],
    parameters: [],
    variables: [],
  },
  bands: {
    detail: [
      {
        height: 96,
        splitType: 'Prevent',
        elements: [
          moldura(0, 0, 135, 92, 0.25),
          campo(4, 4, 127, 24, '$F{nome}', { blankWhenNull: true, textAdjust: 'CutText', style: { bold: true, fontSize: 8 } }),
          campo(4, 30, 72, 10, '"SKU " + $F{sku}', { style: { fontSize: 6 } }),
          campo(4, 44, 72, 16, '$F{preco}', { pattern: '¤ #,##0.00', blankWhenNull: true, style: { bold: true, fontSize: 11 } }),
          campo(4, 66, 72, 10, '$F{lote} == null ? "" : "Lote " + $F{lote}', { style: { fontSize: 6 } }),
          { kind: 'barcode', bounds: { x: 78, y: 32, width: 55, height: 55 }, barcodeType: 'QRCode', expression: '$F{qr}' },
        ],
      },
    ],
    noData: {
      height: 20,
      splitType: 'Stretch',
      elements: [texto(0, 0, 135, 16, 'Sem produtos no payload')],
    },
    groups: [],
  },
};

/** Etiqueta de endereçamento — 2 colunas, 4 linhas por folha, CODE-128 de rastreio. */
export const REFERENCIA_ETIQUETA_ENDERECAMENTO: ReportTemplate = {
  name: 'etiqueta_enderecamento',
  pageFormat: a4Grade(2, 15),
  properties: {
    'reportlenz.datasource.campo': 'envios',
    'reportlenz.template.tipo': 'etiqueta_a4',
  },
  styles: [
    { name: 'base', isDefault: true, fontName: 'DejaVu Sans', fontSize: 9 },
    { name: 'rotulo', fontName: 'DejaVu Sans', fontSize: 6, bold: true },
  ],
  dataContract: {
    fields: [
      {
        name: 'envios',
        type: 'collection',
        itemFields: [
          { name: 'destinatario_nome', type: 'string' },
          { name: 'destinatario_endereco', type: 'string' },
          { name: 'destinatario_cep', type: 'string' },
          { name: 'remetente_nome', type: 'string' },
          { name: 'remetente_endereco', type: 'string' },
          { name: 'rastreio', type: 'string' },
        ],
      },
    ],
    parameters: [],
    variables: [],
  },
  bands: {
    detail: [
      {
        height: 185,
        splitType: 'Prevent',
        elements: [
          moldura(0, 0, 270, 180, 0.75),
          texto(6, 4, 120, 8, 'DESTINATÁRIO', { styleRef: 'rotulo' }),
          campo(6, 14, 258, 16, '$F{destinatario_nome}', { blankWhenNull: true, textAdjust: 'CutText', style: { bold: true, fontSize: 11 } }),
          campo(6, 32, 258, 36, '$F{destinatario_endereco}', { blankWhenNull: true, textAdjust: 'CutText' }),
          campo(6, 70, 180, 16, '"CEP " + $F{destinatario_cep}', { style: { bold: true, fontSize: 11 } }),
          { kind: 'barcode', bounds: { x: 6, y: 90, width: 258, height: 44 }, barcodeType: 'Code128', expression: '$F{rastreio}' },
          { kind: 'line', bounds: { x: 6, y: 138, width: 258, height: 1 }, pen: { lineWidth: 0.25 } },
          texto(6, 142, 120, 8, 'REMETENTE', { styleRef: 'rotulo' }),
          campo(6, 151, 258, 10, '$F{remetente_nome}', { blankWhenNull: true, style: { fontSize: 7 } }),
          campo(6, 162, 258, 16, '$F{remetente_endereco}', { blankWhenNull: true, textAdjust: 'CutText', style: { fontSize: 7 } }),
        ],
      },
    ],
    noData: {
      height: 20,
      splitType: 'Stretch',
      elements: [texto(0, 0, 270, 16, 'Sem envios no payload')],
    },
    groups: [],
  },
};

/** Crachá — 2 colunas, 3 por coluna; foto opcional (falha de imagem = em branco). */
export const REFERENCIA_CRACHA: ReportTemplate = {
  name: 'cracha',
  pageFormat: a4Grade(2, 15),
  properties: {
    'reportlenz.datasource.campo': 'pessoas',
    'reportlenz.template.tipo': 'cracha',
  },
  styles: [{ name: 'base', isDefault: true, fontName: 'DejaVu Sans', fontSize: 8 }],
  dataContract: {
    fields: [
      {
        name: 'pessoas',
        type: 'collection',
        itemFields: [
          { name: 'nome', type: 'string' },
          { name: 'cargo', type: 'string' },
          { name: 'setor', type: 'string' },
          { name: 'matricula', type: 'string' },
          { name: 'foto_url', type: 'string' },
          { name: 'qr', type: 'string' },
        ],
      },
    ],
    parameters: [{ name: 'empresa', type: 'string', defaultValueExpression: '"Empresa"' }],
    variables: [],
  },
  bands: {
    detail: [
      {
        height: 250,
        splitType: 'Prevent',
        elements: [
          moldura(0, 0, 270, 240, 0.75),
          { kind: 'rectangle', bounds: { x: 0, y: 0, width: 270, height: 40 }, style: { mode: 'Opaque', backcolor: AZUL }, pen: { lineWidth: 0 } },
          campo(8, 10, 254, 20, '$P{empresa}', { style: { bold: true, fontSize: 13, forecolor: '#FFFFFF' } }),
          { kind: 'image', bounds: { x: 12, y: 52, width: 90, height: 110 }, expression: '$F{foto_url}', scaleImage: 'RetainShape', onErrorType: 'Blank' },
          moldura(12, 52, 90, 110),
          campo(112, 56, 150, 32, '$F{nome}', { blankWhenNull: true, textAdjust: 'CutText', style: { bold: true, fontSize: 12 } }),
          campo(112, 92, 150, 14, '$F{cargo}', { blankWhenNull: true, style: { fontSize: 9 } }),
          campo(112, 108, 150, 14, '$F{setor}', { blankWhenNull: true, style: { forecolor: '#555555' } }),
          campo(112, 130, 150, 12, '"Matrícula " + $F{matricula}', { style: NEGRITO }),
          { kind: 'barcode', bounds: { x: 190, y: 158, width: 72, height: 72 }, barcodeType: 'QRCode', expression: '$F{qr}' },
          texto(12, 172, 170, 10, 'Uso pessoal e intransferível', { style: { fontSize: 6 } }),
          { kind: 'rectangle', bounds: { x: 0, y: 236, width: 270, height: 4 }, style: { mode: 'Opaque', backcolor: AZUL }, pen: { lineWidth: 0 } },
        ],
      },
    ],
    noData: {
      height: 20,
      splitType: 'Stretch',
      elements: [texto(0, 0, 270, 16, 'Sem pessoas no payload')],
    },
    groups: [],
  },
};
