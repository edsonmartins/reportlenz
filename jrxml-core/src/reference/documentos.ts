/**
 * Cartas e documentos (ADR-022, tarefa variacoes-de-templates/2.4): texto
 * longo elástico e documento multipágina.
 *
 * Regra de layout: o elemento elástico (`StretchHeight`) é o ÚLTIMO da sua
 * banda — o modelo não tem `positionType=Float`, então nada pode ficar abaixo
 * dele na mesma banda; o que vem depois (assinaturas) vai para o `summary`.
 */
import type { ReportTemplate } from '../model/report.js';
import { NEGRITO, a4Retrato, campo, texto } from './comum.js';

/**
 * "São Paulo, 27 de novembro de 2026" — mês por extenso no locale do relatório
 * (pt-BR). `date` chega ao engine como java.sql.Date, daí o SimpleDateFormat.
 */
function localEData(local: string, data: string): string {
  return (
    `${local} + ", " + (${data} == null ? "" : ` +
    `new java.text.SimpleDateFormat("d 'de' MMMM 'de' yyyy", $P{REPORT_LOCALE}).format(${data}))`
  );
}

const CINZA = '#555555';

/** Carta / declaração: timbre, local e data por extenso, corpo longo, assinatura. */
export const REFERENCIA_CARTA_DECLARACAO: ReportTemplate = {
  name: 'carta_declaracao',
  pageFormat: a4Retrato({ leftMargin: 50, rightMargin: 45, topMargin: 40, bottomMargin: 40, columnWidth: 500 }),
  properties: { 'reportlenz.template.tipo': 'carta' },
  styles: [{ name: 'base', isDefault: true, fontName: 'DejaVu Sans', fontSize: 10 }],
  dataContract: {
    fields: [
      { name: 'local', type: 'string' },
      { name: 'data', type: 'date' },
      { name: 'destinatario', type: 'string', description: 'Destinatário (até 3 linhas)' },
      { name: 'assunto', type: 'string' },
      { name: 'corpo', type: 'string', description: 'Corpo da carta — parágrafos separados por linha em branco' },
      { name: 'signatario.nome', type: 'string' },
      { name: 'signatario.cargo', type: 'string' },
    ],
    parameters: [
      { name: 'empresa', type: 'string', defaultValueExpression: '"Empresa"' },
      { name: 'empresa_endereco', type: 'string' },
      { name: 'rodape', type: 'string' },
    ],
    variables: [],
  },
  bands: {
    title: {
      height: 64,
      splitType: 'Stretch',
      elements: [
        campo(0, 0, 500, 22, '$P{empresa}', { style: { bold: true, fontSize: 16 } }),
        campo(0, 24, 500, 24, '$P{empresa_endereco}', { blankWhenNull: true, style: { fontSize: 8, forecolor: CINZA } }),
        { kind: 'line', bounds: { x: 0, y: 54, width: 500, height: 1 }, pen: { lineWidth: 1, lineColor: '#1565C0' } },
      ],
    },
    detail: [
      {
        height: 150,
        splitType: 'Stretch',
        elements: [
          campo(200, 0, 300, 14, localEData('$F{local}', '$F{data}'), { style: { hAlign: 'Right' } }),
          campo(0, 30, 500, 42, '$F{destinatario}', { blankWhenNull: true, textAdjust: 'CutText' }),
          campo(0, 80, 500, 14, '"Assunto: " + $F{assunto}', { style: NEGRITO }),
          campo(0, 104, 500, 40, '$F{corpo}', { blankWhenNull: true, textAdjust: 'StretchHeight', style: { hAlign: 'Justified' } }),
        ],
      },
    ],
    pageFooter: {
      height: 20,
      splitType: 'Stretch',
      elements: [campo(0, 6, 500, 12, '$P{rodape}', { blankWhenNull: true, style: { fontSize: 7, forecolor: CINZA, hAlign: 'Center' } })],
    },
    summary: {
      height: 100,
      splitType: 'Prevent',
      elements: [
        texto(0, 20, 300, 14, 'Atenciosamente,'),
        { kind: 'line', bounds: { x: 0, y: 70, width: 250, height: 1 }, pen: { lineWidth: 0.5 } },
        campo(0, 73, 250, 12, '$F{signatario.nome}', { blankWhenNull: true, style: NEGRITO }),
        campo(0, 86, 250, 12, '$F{signatario.cargo}', { blankWhenNull: true }),
      ],
    },
    groups: [],
  },
};

/**
 * Contrato multipágina: cada cláusula é uma linha do mestre (ADR-015);
 * cabeçalho e rodapé (rubrica + página) em todas as folhas; assinaturas e
 * testemunhas no `summary`, depois da última cláusula.
 */
export const REFERENCIA_CONTRATO: ReportTemplate = {
  name: 'contrato_servicos',
  pageFormat: a4Retrato({ leftMargin: 50, rightMargin: 45, topMargin: 40, bottomMargin: 40, columnWidth: 500 }),
  properties: {
    'reportlenz.datasource.campo': 'clausulas',
    'reportlenz.template.tipo': 'contrato',
  },
  styles: [{ name: 'base', isDefault: true, fontName: 'DejaVu Sans', fontSize: 9 }],
  dataContract: {
    fields: [
      {
        name: 'clausulas',
        type: 'collection',
        itemFields: [
          { name: 'numero', type: 'integer' },
          { name: 'titulo', type: 'string' },
          { name: 'texto', type: 'string' },
        ],
      },
    ],
    parameters: [
      { name: 'numero_contrato', type: 'string' },
      { name: 'contratante', type: 'string' },
      { name: 'contratada', type: 'string' },
      { name: 'cidade', type: 'string' },
      { name: 'data_assinatura', type: 'date' },
    ],
    variables: [],
  },
  bands: {
    title: {
      height: 100,
      splitType: 'Stretch',
      elements: [
        texto(0, 0, 500, 20, 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS', { style: { bold: true, fontSize: 14, hAlign: 'Center' } }),
        campo(0, 24, 500, 14, '"Contrato nº " + $P{numero_contrato}', { style: { hAlign: 'Center' } }),
        campo(
          0,
          48,
          500,
          44,
          '"CONTRATANTE: " + $P{contratante} + ".\\nCONTRATADA: " + $P{contratada} + ".\\nAs partes acima identificadas têm entre si justo e contratado o que segue, regido pelas cláusulas abaixo."',
          { textAdjust: 'StretchHeight', style: { hAlign: 'Justified' } },
        ),
      ],
    },
    pageHeader: {
      height: 22,
      splitType: 'Stretch',
      elements: [
        campo(200, 0, 300, 12, '"Contrato nº " + $P{numero_contrato}', { style: { hAlign: 'Right', fontSize: 7, forecolor: CINZA } }),
        { kind: 'line', bounds: { x: 0, y: 16, width: 500, height: 1 }, pen: { lineWidth: 0.25 } },
      ],
    },
    detail: [
      {
        height: 40,
        splitType: 'Stretch',
        elements: [
          campo(0, 4, 500, 14, '"CLÁUSULA " + $F{numero} + " — " + $F{titulo}', { textAdjust: 'CutText', style: NEGRITO }),
          campo(0, 20, 500, 16, '$F{texto}', { blankWhenNull: true, textAdjust: 'StretchHeight', style: { hAlign: 'Justified' } }),
        ],
      },
    ],
    pageFooter: {
      height: 24,
      splitType: 'Stretch',
      elements: [
        { kind: 'line', bounds: { x: 0, y: 2, width: 500, height: 1 }, pen: { lineWidth: 0.25 } },
        texto(0, 8, 300, 12, 'Rubricas: ______________     ______________', { style: { fontSize: 7 } }),
        campo(400, 8, 100, 12, '"Página " + $V{PAGE_NUMBER}', { style: { hAlign: 'Right', fontSize: 7 } }),
      ],
    },
    summary: {
      height: 170,
      splitType: 'Prevent',
      elements: [
        campo(0, 16, 500, 14, localEData('$P{cidade}', '$P{data_assinatura}'), { style: { hAlign: 'Center' } }),
        { kind: 'line', bounds: { x: 0, y: 80, width: 230, height: 1 }, pen: { lineWidth: 0.5 } },
        campo(0, 83, 230, 12, '$P{contratante}', { blankWhenNull: true, style: { bold: true, hAlign: 'Center' } }),
        texto(0, 96, 230, 10, 'CONTRATANTE', { style: { fontSize: 7, hAlign: 'Center' } }),
        { kind: 'line', bounds: { x: 270, y: 80, width: 230, height: 1 }, pen: { lineWidth: 0.5 } },
        campo(270, 83, 230, 12, '$P{contratada}', { blankWhenNull: true, style: { bold: true, hAlign: 'Center' } }),
        texto(270, 96, 230, 10, 'CONTRATADA', { style: { fontSize: 7, hAlign: 'Center' } }),
        { kind: 'line', bounds: { x: 0, y: 140, width: 230, height: 1 }, pen: { lineWidth: 0.5 } },
        texto(0, 143, 230, 10, 'Testemunha 1 — nome e CPF', { style: { fontSize: 7, hAlign: 'Center' } }),
        { kind: 'line', bounds: { x: 270, y: 140, width: 230, height: 1 }, pen: { lineWidth: 0.5 } },
        texto(270, 143, 230, 10, 'Testemunha 2 — nome e CPF', { style: { fontSize: 7, hAlign: 'Center' } }),
      ],
    },
    noData: {
      height: 20,
      splitType: 'Stretch',
      elements: [texto(0, 0, 500, 16, 'Contrato sem cláusulas no payload')],
    },
    groups: [],
  },
};
