/**
 * Modelos fiscais e de cobrança (ADR-022, tarefa variacoes-de-templates/2.1).
 *
 * Desenhados a partir das especificações PÚBLICAS — nenhum JRXML de terceiros
 * é copiado:
 * - boleto: ficha de compensação FEBRABAN / Circulares BCB 2.531 e 2.926
 *   (código de barras Interleaved 2 of 5 de 44 posições, linha digitável);
 * - DANFE: Manual de Especificações Técnicas do DANFE (MOC, Anexo II) —
 *   canhoto, quadro DANFE, CODE-128C só com a chave de 44 dígitos, chave
 *   impressa em 11 blocos de 4, emitente repetido em cada folha.
 *
 * Contract-first (ADR-003): DV, fator de vencimento, campo livre e chave de
 * acesso são calculados pelo backend de domínio e chegam PRONTOS no payload —
 * o template só os desenha.
 */
import type { ReportTemplate } from '../model/report.js';
import type { Element, TableCell, TableColumn } from '../model/elements.js';
import { DIREITA, NEGRITO, a4Retrato, caixaRotulada, campo, linhaDeCorte, moldura, texto } from './comum.js';

const MOEDA = '¤ #,##0.00';
const NUMERO = '#,##0.00';
const DATA = 'dd/MM/yyyy';

// ---------------------------------------------------------------------------
// Boleto

function cabecalhoDoBanco(y: number, direita: Element): Element[] {
  return [
    campo(0, y, 150, 22, '$F{banco.nome}', { style: { bold: true, fontSize: 12 } }),
    moldura(150, y, 60, 22),
    campo(150, y + 3, 60, 18, '$F{banco.codigo}', { style: { bold: true, fontSize: 13, hAlign: 'Center' } }),
    direita,
  ];
}

/** Boleto de cobrança: recibo do pagador (destacável) + ficha de compensação. */
export const REFERENCIA_BOLETO: ReportTemplate = {
  name: 'boleto_cobranca',
  pageFormat: a4Retrato(),
  properties: { 'reportlenz.template.tipo': 'boleto' },
  styles: [
    { name: 'base', isDefault: true, fontName: 'DejaVu Sans', fontSize: 8 },
    { name: 'rotulo', fontName: 'DejaVu Sans', fontSize: 5 },
  ],
  dataContract: {
    fields: [
      { name: 'banco.nome', type: 'string' },
      { name: 'banco.codigo', type: 'string', description: 'Código do banco com DV (ex.: 341-7)' },
      { name: 'beneficiario.nome', type: 'string' },
      { name: 'beneficiario.documento', type: 'string' },
      { name: 'beneficiario.agencia_codigo', type: 'string' },
      { name: 'pagador.nome', type: 'string' },
      { name: 'pagador.documento', type: 'string' },
      { name: 'pagador.endereco', type: 'string' },
      { name: 'linha_digitavel', type: 'string', description: 'Linha digitável formatada (47 dígitos), calculada a montante' },
      { name: 'codigo_barras', type: 'string', description: 'Código de barras de 44 posições (I2of5), calculado a montante' },
      { name: 'vencimento', type: 'date' },
      { name: 'valor', type: 'decimal' },
      { name: 'nosso_numero', type: 'string' },
      { name: 'numero_documento', type: 'string' },
      { name: 'data_documento', type: 'date' },
      { name: 'especie_documento', type: 'string' },
      { name: 'aceite', type: 'string' },
      { name: 'carteira', type: 'string' },
      { name: 'local_pagamento', type: 'string' },
      { name: 'instrucoes', type: 'string' },
    ],
    parameters: [],
    variables: [],
  },
  bands: {
    detail: [
      {
        height: 480,
        splitType: 'Prevent',
        elements: [
          // --- Recibo do pagador
          ...cabecalhoDoBanco(0, texto(380, 6, 175, 14, 'Recibo do Pagador', { style: { bold: true, hAlign: 'Right' } })),
          ...caixaRotulada(0, 24, 330, 24, 'BENEFICIÁRIO', '$F{beneficiario.nome} + " — " + $F{beneficiario.documento}'),
          ...caixaRotulada(330, 24, 110, 24, 'AGÊNCIA/CÓDIGO DO BENEFICIÁRIO', '$F{beneficiario.agencia_codigo}'),
          ...caixaRotulada(440, 24, 115, 24, 'VENCIMENTO', '$F{vencimento}', { pattern: DATA, style: { ...DIREITA, ...NEGRITO } }),
          ...caixaRotulada(0, 48, 330, 24, 'PAGADOR', '$F{pagador.nome}'),
          ...caixaRotulada(330, 48, 110, 24, 'NOSSO NÚMERO', '$F{nosso_numero}'),
          ...caixaRotulada(440, 48, 115, 24, 'VALOR DO DOCUMENTO', '$F{valor}', { pattern: MOEDA, style: { ...DIREITA, ...NEGRITO } }),
          ...caixaRotulada(0, 72, 330, 24, 'NÚMERO DO DOCUMENTO', '$F{numero_documento}'),
          ...caixaRotulada(330, 72, 225, 24, 'LINHA DIGITÁVEL', '$F{linha_digitavel}', { style: { fontSize: 6 } }),
          texto(330, 100, 225, 10, 'Autenticação mecânica', { styleRef: 'rotulo', style: DIREITA }),
          linhaDeCorte(125),
          texto(0, 127, 555, 8, 'Corte na linha pontilhada', { styleRef: 'rotulo', style: DIREITA }),

          // --- Ficha de compensação
          ...cabecalhoDoBanco(
            140,
            campo(215, 146, 340, 16, '$F{linha_digitavel}', { style: { bold: true, fontSize: 9, hAlign: 'Right' } }),
          ),
          ...caixaRotulada(0, 164, 440, 24, 'LOCAL DE PAGAMENTO', '$F{local_pagamento}'),
          ...caixaRotulada(440, 164, 115, 24, 'VENCIMENTO', '$F{vencimento}', { pattern: DATA, style: { ...DIREITA, ...NEGRITO } }),
          ...caixaRotulada(0, 188, 440, 24, 'BENEFICIÁRIO', '$F{beneficiario.nome} + " — " + $F{beneficiario.documento}'),
          ...caixaRotulada(440, 188, 115, 24, 'AGÊNCIA/CÓDIGO DO BENEFICIÁRIO', '$F{beneficiario.agencia_codigo}', { style: DIREITA }),
          ...caixaRotulada(0, 212, 90, 24, 'DATA DO DOCUMENTO', '$F{data_documento}', { pattern: DATA }),
          ...caixaRotulada(90, 212, 110, 24, 'Nº DO DOCUMENTO', '$F{numero_documento}'),
          ...caixaRotulada(200, 212, 60, 24, 'ESPÉCIE DOC.', '$F{especie_documento}'),
          ...caixaRotulada(260, 212, 50, 24, 'ACEITE', '$F{aceite}'),
          ...caixaRotulada(310, 212, 130, 24, 'DATA PROCESSAMENTO', '$F{data_documento}', { pattern: DATA }),
          ...caixaRotulada(440, 212, 115, 24, 'NOSSO NÚMERO', '$F{nosso_numero}', { style: DIREITA }),
          ...caixaRotulada(0, 236, 90, 24, 'USO DO BANCO', '""'),
          ...caixaRotulada(90, 236, 60, 24, 'CARTEIRA', '$F{carteira}'),
          ...caixaRotulada(150, 236, 50, 24, 'ESPÉCIE', '"R$"'),
          ...caixaRotulada(200, 236, 110, 24, 'QUANTIDADE', '""'),
          ...caixaRotulada(310, 236, 130, 24, 'VALOR', '""'),
          ...caixaRotulada(440, 236, 115, 24, '(=) VALOR DO DOCUMENTO', '$F{valor}', { pattern: MOEDA, style: { ...DIREITA, ...NEGRITO } }),
          ...caixaRotulada(0, 260, 440, 96, 'INSTRUÇÕES (TEXTO DE RESPONSABILIDADE DO BENEFICIÁRIO)', '$F{instrucoes}', { textAdjust: 'CutText' }),
          ...caixaRotulada(440, 260, 115, 24, '(-) DESCONTO / ABATIMENTO', '""'),
          ...caixaRotulada(440, 284, 115, 24, '(+) MORA / MULTA', '""'),
          ...caixaRotulada(440, 308, 115, 24, '(+) OUTROS ACRÉSCIMOS', '""'),
          ...caixaRotulada(440, 332, 115, 24, '(=) VALOR COBRADO', '""'),
          moldura(0, 356, 555, 40),
          texto(2, 357, 100, 7, 'PAGADOR', { styleRef: 'rotulo' }),
          campo(2, 364, 551, 12, '$F{pagador.nome} + " — " + $F{pagador.documento}', { blankWhenNull: true }),
          campo(2, 378, 551, 16, '$F{pagador.endereco}', { blankWhenNull: true, textAdjust: 'CutText' }),
          texto(330, 398, 225, 8, 'Autenticação mecânica — FICHA DE COMPENSAÇÃO', { styleRef: 'rotulo', style: DIREITA }),
          // I2of5 de 44 posições — sem dígito extra: o DV geral já está na 5ª posição.
          // Sem texto legível (ADR-023): a representação numérica é a linha digitável.
          {
            kind: 'barcode',
            bounds: { x: 0, y: 406, width: 330, height: 54 },
            barcodeType: 'Interleaved2Of5',
            expression: '$F{codigo_barras}',
            textPosition: 'none',
          },
          linhaDeCorte(472),
        ],
      },
    ],
    groups: [],
  },
};

// ---------------------------------------------------------------------------
// DANFE

function cabecalhoDeTabela(width: number, rotulo: string, direita = false): TableCell {
  return {
    height: 14,
    elements: [texto(1, 0, width - 2, 14, rotulo, { styleRef: 'rotulo', style: direita ? { bold: true, hAlign: 'Right', vAlign: 'Middle' } : { bold: true, vAlign: 'Middle' } })],
  };
}

function coluna(width: number, rotulo: string, expression: string, opcoes: { pattern?: string; direita?: boolean } = {}): TableColumn {
  return {
    width,
    header: cabecalhoDeTabela(width, rotulo, opcoes.direita),
    detail: {
      height: 11,
      elements: [
        campo(1, 0, width - 2, 11, expression, {
          blankWhenNull: true,
          ...(opcoes.pattern ? { pattern: opcoes.pattern } : {}),
          ...(opcoes.direita ? { style: DIREITA } : {}),
        }),
      ],
    },
  };
}

/** Chave de acesso impressa em 11 blocos de 4 dígitos (MOC, Anexo II). */
const CHAVE_FORMATADA = '$F{chave_acesso} == null ? "" : $F{chave_acesso}.replaceAll("(.{4})", "$1 ").trim()';

/** DANFE retrato (NF-e modelo 55) — leiaute do MOC, Anexo II. */
export const REFERENCIA_DANFE: ReportTemplate = {
  name: 'danfe_retrato',
  pageFormat: a4Retrato({ topMargin: 20, bottomMargin: 20 }),
  properties: { 'reportlenz.template.tipo': 'danfe' },
  styles: [
    { name: 'base', isDefault: true, fontName: 'DejaVu Sans', fontSize: 7 },
    { name: 'rotulo', fontName: 'DejaVu Sans', fontSize: 5 },
  ],
  dataContract: {
    fields: [
      { name: 'chave_acesso', type: 'string', description: 'Chave de acesso de 44 dígitos (CODE-128C), gerada a montante' },
      { name: 'numero', type: 'string' },
      { name: 'serie', type: 'string' },
      { name: 'tipo_operacao', type: 'string', description: '0 = entrada, 1 = saída' },
      { name: 'natureza_operacao', type: 'string' },
      { name: 'protocolo', type: 'string', description: 'Protocolo de autorização de uso com data/hora' },
      { name: 'data_emissao', type: 'date' },
      { name: 'data_saida', type: 'date' },
      { name: 'emitente.nome', type: 'string' },
      { name: 'emitente.endereco', type: 'string' },
      { name: 'emitente.cnpj', type: 'string' },
      { name: 'emitente.ie', type: 'string' },
      { name: 'destinatario.nome', type: 'string' },
      { name: 'destinatario.documento', type: 'string' },
      { name: 'destinatario.endereco', type: 'string' },
      { name: 'destinatario.municipio', type: 'string' },
      { name: 'destinatario.uf', type: 'string' },
      { name: 'destinatario.ie', type: 'string' },
      { name: 'destinatario.telefone', type: 'string' },
      { name: 'impostos.base_icms', type: 'decimal' },
      { name: 'impostos.valor_icms', type: 'decimal' },
      { name: 'impostos.valor_produtos', type: 'decimal' },
      { name: 'impostos.valor_frete', type: 'decimal' },
      { name: 'impostos.valor_total', type: 'decimal' },
      { name: 'transportador.nome', type: 'string' },
      { name: 'transportador.modalidade_frete', type: 'string' },
      {
        name: 'produtos',
        type: 'collection',
        itemFields: [
          { name: 'codigo', type: 'string' },
          { name: 'descricao', type: 'string' },
          { name: 'ncm', type: 'string' },
          { name: 'cfop', type: 'string' },
          { name: 'unidade', type: 'string' },
          { name: 'quantidade', type: 'decimal' },
          { name: 'valor_unitario', type: 'decimal' },
          { name: 'valor_total', type: 'decimal' },
        ],
      },
      { name: 'informacoes_complementares', type: 'string' },
    ],
    parameters: [],
    variables: [],
  },
  bands: {
    // Canhoto: só na 1ª folha.
    title: {
      height: 62,
      splitType: 'Prevent',
      elements: [
        moldura(0, 0, 455, 50),
        campo(
          2,
          2,
          451,
          16,
          '"RECEBEMOS DE " + $F{emitente.nome} + " OS PRODUTOS E/OU SERVIÇOS CONSTANTES DA NOTA FISCAL ELETRÔNICA INDICADA AO LADO"',
          { style: { fontSize: 6 } },
        ),
        ...caixaRotulada(0, 20, 120, 30, 'DATA DE RECEBIMENTO', '""'),
        ...caixaRotulada(120, 20, 335, 30, 'IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR', '""'),
        moldura(455, 0, 100, 50),
        texto(457, 4, 96, 12, 'NF-e', { style: { bold: true, fontSize: 10, hAlign: 'Center' } }),
        campo(457, 18, 96, 12, '"Nº " + $F{numero}', { style: { bold: true, hAlign: 'Center' } }),
        campo(457, 32, 96, 12, '"SÉRIE " + $F{serie}', { style: { hAlign: 'Center' } }),
        linhaDeCorte(56),
      ],
    },
    // Identificação do emitente + quadro DANFE + chave: repetidos em TODA folha.
    pageHeader: {
      height: 132,
      splitType: 'Prevent',
      elements: [
        moldura(0, 0, 230, 86),
        texto(2, 1, 226, 7, 'IDENTIFICAÇÃO DO EMITENTE', { styleRef: 'rotulo' }),
        campo(4, 10, 222, 14, '$F{emitente.nome}', { style: { bold: true, fontSize: 9, hAlign: 'Center' } }),
        campo(4, 26, 222, 40, '$F{emitente.endereco}', { blankWhenNull: true, style: { hAlign: 'Center' } }),
        moldura(230, 0, 100, 86),
        texto(232, 3, 96, 14, 'DANFE', { style: { bold: true, fontSize: 12, hAlign: 'Center' } }),
        texto(232, 18, 96, 16, 'Documento Auxiliar da Nota Fiscal Eletrônica', { style: { fontSize: 6, hAlign: 'Center' } }),
        texto(236, 38, 60, 16, '0 - ENTRADA\n1 - SAÍDA', { style: { fontSize: 6 } }),
        moldura(300, 39, 18, 14),
        campo(300, 40, 18, 12, '$F{tipo_operacao}', { style: { bold: true, fontSize: 9, hAlign: 'Center' } }),
        campo(232, 56, 96, 10, '"Nº " + $F{numero}', { style: { bold: true, hAlign: 'Center' } }),
        campo(232, 66, 96, 10, '"SÉRIE " + $F{serie}', { style: { hAlign: 'Center' } }),
        campo(232, 76, 96, 10, '"FOLHA " + $V{PAGE_NUMBER}', { style: { hAlign: 'Center' } }),
        moldura(330, 0, 225, 86),
        // CODE-128 (o barcode4j escolhe o subconjunto C para 44 dígitos) — SÓ a chave.
        // Sem texto legível (ADR-023): ele não cabia e saía cortado; a chave vem
        // formatada em 11 blocos logo abaixo, como o MOC exige.
        {
          kind: 'barcode',
          bounds: { x: 336, y: 3, width: 213, height: 34 },
          barcodeType: 'Code128',
          expression: '$F{chave_acesso}',
          textPosition: 'none',
        },
        texto(332, 39, 221, 7, 'CHAVE DE ACESSO', { styleRef: 'rotulo' }),
        campo(332, 47, 221, 11, CHAVE_FORMATADA, { style: { bold: true, fontSize: 6, hAlign: 'Center' } }),
        texto(
          332,
          61,
          221,
          22,
          'Consulta de autenticidade no portal nacional da NF-e www.nfe.fazenda.gov.br/portal ou no site da Sefaz Autorizadora',
          { style: { fontSize: 6, hAlign: 'Center' } },
        ),
        ...caixaRotulada(0, 86, 330, 22, 'NATUREZA DA OPERAÇÃO', '$F{natureza_operacao}'),
        ...caixaRotulada(330, 86, 225, 22, 'PROTOCOLO DE AUTORIZAÇÃO DE USO', '$F{protocolo}'),
        ...caixaRotulada(0, 108, 185, 22, 'INSCRIÇÃO ESTADUAL', '$F{emitente.ie}'),
        ...caixaRotulada(185, 108, 185, 22, 'INSCRIÇÃO ESTADUAL DO SUBST. TRIBUTÁRIO', '""'),
        ...caixaRotulada(370, 108, 185, 22, 'CNPJ', '$F{emitente.cnpj}'),
      ],
    },
    detail: [
      {
        height: 200,
        splitType: 'Stretch',
        elements: [
          texto(0, 2, 555, 9, 'DESTINATÁRIO / REMETENTE', { style: { bold: true } }),
          ...caixaRotulada(0, 11, 300, 22, 'NOME / RAZÃO SOCIAL', '$F{destinatario.nome}'),
          ...caixaRotulada(300, 11, 160, 22, 'CNPJ / CPF', '$F{destinatario.documento}'),
          ...caixaRotulada(460, 11, 95, 22, 'DATA DA EMISSÃO', '$F{data_emissao}', { pattern: DATA }),
          ...caixaRotulada(0, 33, 300, 22, 'ENDEREÇO', '$F{destinatario.endereco}'),
          ...caixaRotulada(300, 33, 160, 22, 'MUNICÍPIO', '$F{destinatario.municipio}'),
          ...caixaRotulada(460, 33, 95, 22, 'DATA DA SAÍDA/ENTRADA', '$F{data_saida}', { pattern: DATA }),
          ...caixaRotulada(0, 55, 60, 22, 'UF', '$F{destinatario.uf}'),
          ...caixaRotulada(60, 55, 240, 22, 'INSCRIÇÃO ESTADUAL', '$F{destinatario.ie}'),
          ...caixaRotulada(300, 55, 255, 22, 'FONE / FAX', '$F{destinatario.telefone}'),
          texto(0, 79, 555, 9, 'CÁLCULO DO IMPOSTO', { style: { bold: true } }),
          ...caixaRotulada(0, 88, 111, 22, 'BASE DE CÁLCULO DO ICMS', '$F{impostos.base_icms}', { pattern: NUMERO, style: DIREITA }),
          ...caixaRotulada(111, 88, 111, 22, 'VALOR DO ICMS', '$F{impostos.valor_icms}', { pattern: NUMERO, style: DIREITA }),
          ...caixaRotulada(222, 88, 111, 22, 'VALOR TOTAL DOS PRODUTOS', '$F{impostos.valor_produtos}', { pattern: NUMERO, style: DIREITA }),
          ...caixaRotulada(333, 88, 111, 22, 'VALOR DO FRETE', '$F{impostos.valor_frete}', { pattern: NUMERO, style: DIREITA }),
          ...caixaRotulada(444, 88, 111, 22, 'VALOR TOTAL DA NOTA', '$F{impostos.valor_total}', { pattern: NUMERO, style: { ...DIREITA, ...NEGRITO } }),
          texto(0, 112, 555, 9, 'TRANSPORTADOR / VOLUMES TRANSPORTADOS', { style: { bold: true } }),
          ...caixaRotulada(0, 121, 370, 22, 'RAZÃO SOCIAL', '$F{transportador.nome}'),
          ...caixaRotulada(370, 121, 185, 22, 'FRETE POR CONTA', '$F{transportador.modalidade_frete}'),
          texto(0, 145, 555, 9, 'DADOS DOS PRODUTOS / SERVIÇOS', { style: { bold: true } }),
          {
            kind: 'table',
            bounds: { x: 0, y: 155, width: 555, height: 40 },
            datasetField: 'produtos',
            columns: [
              coluna(55, 'CÓDIGO', '$F{codigo}'),
              coluna(190, 'DESCRIÇÃO DO PRODUTO / SERVIÇO', '$F{descricao}'),
              coluna(45, 'NCM/SH', '$F{ncm}'),
              coluna(35, 'CFOP', '$F{cfop}'),
              coluna(25, 'UN', '$F{unidade}'),
              coluna(50, 'QUANT.', '$F{quantidade}', { pattern: '#,##0.####', direita: true }),
              coluna(70, 'VALOR UNIT.', '$F{valor_unitario}', { pattern: NUMERO, direita: true }),
              coluna(85, 'VALOR TOTAL', '$F{valor_total}', { pattern: NUMERO, direita: true }),
            ],
          },
        ],
      },
    ],
    summary: {
      height: 66,
      splitType: 'Prevent',
      elements: [
        texto(0, 4, 555, 9, 'DADOS ADICIONAIS', { style: { bold: true } }),
        ...caixaRotulada(0, 13, 370, 50, 'INFORMAÇÕES COMPLEMENTARES', '$F{informacoes_complementares}', { style: { fontSize: 6 }, textAdjust: 'CutText' }),
        ...caixaRotulada(370, 13, 185, 50, 'RESERVADO AO FISCO', '""'),
      ],
    },
    groups: [],
  },
};

// ---------------------------------------------------------------------------
// Orçamento

/** Orçamento / pedido de venda: total por item calculado no template (qtd × preço). */
export const REFERENCIA_ORCAMENTO: ReportTemplate = {
  name: 'orcamento_venda',
  pageFormat: a4Retrato(),
  properties: { 'reportlenz.template.tipo': 'orcamento' },
  styles: [
    { name: 'base', isDefault: true, fontName: 'DejaVu Sans', fontSize: 9 },
    { name: 'rotulo', fontName: 'DejaVu Sans', fontSize: 6 },
  ],
  dataContract: {
    fields: [
      { name: 'numero', type: 'string' },
      { name: 'emissao', type: 'date' },
      { name: 'validade', type: 'date' },
      { name: 'vendedor', type: 'string' },
      { name: 'empresa.nome', type: 'string' },
      { name: 'empresa.contato', type: 'string' },
      { name: 'cliente.nome', type: 'string' },
      { name: 'cliente.documento', type: 'string' },
      { name: 'cliente.contato', type: 'string' },
      {
        name: 'itens',
        type: 'collection',
        itemFields: [
          { name: 'descricao', type: 'string' },
          { name: 'quantidade', type: 'decimal' },
          { name: 'unidade', type: 'string' },
          { name: 'preco_unitario', type: 'decimal' },
        ],
      },
      { name: 'subtotal', type: 'decimal', description: 'Soma dos itens (calculada a montante)' },
      { name: 'desconto', type: 'decimal' },
      { name: 'total', type: 'decimal' },
      { name: 'condicoes', type: 'string', description: 'Condições comerciais (texto livre, elástico)' },
    ],
    parameters: [{ name: 'logo_url', type: 'string' }],
    variables: [],
  },
  bands: {
    title: {
      height: 64,
      splitType: 'Stretch',
      elements: [
        { kind: 'image', bounds: { x: 0, y: 0, width: 110, height: 50 }, expression: '$P{logo_url}', scaleImage: 'RetainShape', onErrorType: 'Blank' },
        campo(120, 0, 300, 18, '$F{empresa.nome}', { style: { bold: true, fontSize: 13 } }),
        campo(120, 20, 300, 24, '$F{empresa.contato}', { blankWhenNull: true, style: { fontSize: 8 } }),
        texto(420, 0, 135, 18, 'ORÇAMENTO', { style: { bold: true, fontSize: 14, hAlign: 'Right' } }),
        campo(420, 20, 135, 14, '"Nº " + $F{numero}', { style: DIREITA }),
        { kind: 'line', bounds: { x: 0, y: 58, width: 555, height: 1 }, pen: { lineWidth: 0.5 } },
      ],
    },
    detail: [
      {
        height: 140,
        splitType: 'Stretch',
        elements: [
          ...caixaRotulada(0, 0, 277, 28, 'CLIENTE', '$F{cliente.nome}'),
          ...caixaRotulada(277, 0, 140, 28, 'CNPJ / CPF', '$F{cliente.documento}'),
          ...caixaRotulada(417, 0, 138, 28, 'CONTATO', '$F{cliente.contato}'),
          ...caixaRotulada(0, 28, 140, 28, 'EMISSÃO', '$F{emissao}', { pattern: DATA }),
          ...caixaRotulada(140, 28, 137, 28, 'VÁLIDO ATÉ', '$F{validade}', { pattern: DATA, style: NEGRITO }),
          ...caixaRotulada(277, 28, 278, 28, 'VENDEDOR', '$F{vendedor}'),
          {
            kind: 'table',
            bounds: { x: 0, y: 66, width: 555, height: 60 },
            datasetField: 'itens',
            columns: [
              {
                width: 255,
                header: { height: 16, elements: [texto(0, 0, 255, 16, 'Descrição', { style: NEGRITO })] },
                detail: { height: 14, elements: [campo(0, 0, 255, 14, '$F{descricao}')] },
              },
              {
                width: 60,
                header: { height: 16, elements: [texto(0, 0, 60, 16, 'Qtde', { style: { bold: true, hAlign: 'Right' } })] },
                detail: { height: 14, elements: [campo(0, 0, 60, 14, '$F{quantidade}', { pattern: '#,##0.###', style: DIREITA })] },
              },
              {
                width: 40,
                header: { height: 16, elements: [texto(4, 0, 36, 16, 'Un', { style: NEGRITO })] },
                detail: { height: 14, elements: [campo(4, 0, 36, 14, '$F{unidade}')] },
              },
              {
                width: 95,
                header: { height: 16, elements: [texto(0, 0, 95, 16, 'Preço unit.', { style: { bold: true, hAlign: 'Right' } })] },
                detail: { height: 14, elements: [campo(0, 0, 95, 14, '$F{preco_unitario}', { pattern: MOEDA, style: DIREITA })] },
              },
              {
                width: 105,
                header: { height: 16, elements: [texto(0, 0, 105, 16, 'Total', { style: { bold: true, hAlign: 'Right' } })] },
                detail: {
                  height: 14,
                  elements: [
                    campo(
                      0,
                      0,
                      105,
                      14,
                      '$F{quantidade} == null || $F{preco_unitario} == null ? null : $F{quantidade}.multiply($F{preco_unitario}).setScale(2, java.math.RoundingMode.HALF_UP)',
                      { pattern: MOEDA, blankWhenNull: true, style: DIREITA },
                    ),
                  ],
                },
              },
            ],
          },
        ],
      },
    ],
    summary: {
      height: 120,
      splitType: 'Prevent',
      elements: [
        texto(355, 4, 100, 14, 'Subtotal', { style: DIREITA }),
        campo(455, 4, 100, 14, '$F{subtotal}', { pattern: MOEDA, blankWhenNull: true, style: DIREITA }),
        texto(355, 20, 100, 14, 'Desconto', { style: DIREITA }),
        campo(455, 20, 100, 14, '$F{desconto}', { pattern: MOEDA, blankWhenNull: true, style: DIREITA }),
        texto(355, 38, 100, 16, 'Total', { style: { bold: true, fontSize: 11, hAlign: 'Right' } }),
        campo(455, 38, 100, 16, '$F{total}', { pattern: MOEDA, blankWhenNull: true, style: { bold: true, fontSize: 11, hAlign: 'Right' } }),
        { kind: 'line', bounds: { x: 0, y: 58, width: 250, height: 1 }, pen: { lineWidth: 0.5 } },
        texto(0, 61, 250, 12, 'Aceite do cliente (assinatura e data)', { styleRef: 'rotulo' }),
        texto(0, 84, 555, 10, 'CONDIÇÕES COMERCIAIS', { styleRef: 'rotulo', style: NEGRITO }),
        // Elástico e por ÚLTIMO na banda: estica sem sobrepor nada abaixo.
        campo(0, 96, 555, 20, '$F{condicoes}', { blankWhenNull: true, textAdjust: 'StretchHeight' }),
      ],
    },
    groups: [],
  },
};
