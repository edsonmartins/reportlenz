/**
 * Cenários de teste DECLARATIVOS do catálogo de referência (ADR-022, tarefa
 * variacoes-de-templates/2.5).
 *
 * Cada modelo declara payloads (no formato ANINHADO do inputSchema — nomes
 * pontuados viram objeto, coleções viram array) e o que o render real deve
 * produzir. Todas as camadas percorrem estes dados — core (payload ×
 * inputSchema), engine (PDF, páginas, códigos de barras lidos com ZXing) —
 * sem teste escrito por modelo. Emitidos pelo `emit:fixtures` como
 * `<chave>.cenarios.json`.
 *
 * Regras:
 * - JSON Schema não aceita `null` nos tipos gerados: campo ausente = OMITIDO.
 * - `minimo` traz só o essencial e espera que nada imprima "null".
 * - DV de boleto e chave de NF-e são calculados AQUI, como faria o backend de
 *   domínio — o template só os desenha (contract-first, ADR-003).
 */

export type NomeDoCenario = 'tipico' | 'minimo' | 'volume' | 'textos_longos';

/** Simbologias que o teste do engine decodifica (nomes do ZXing BarcodeFormat). */
export type FormatoDeCodigo = 'QR_CODE' | 'CODE_128' | 'ITF' | 'EAN_13';

export interface CodigoEsperado {
  formato: FormatoDeCodigo;
  valor: string;
}

export interface Expectativa {
  /** Trechos que DEVEM aparecer no texto do PDF. */
  textos?: string[];
  /** Trechos que NÃO podem aparecer (ex.: "null" de concatenação). */
  ausentes?: string[];
  /** Faixa de páginas do PDF. */
  paginas?: { min: number; max?: number };
  /** Trechos que devem aparecer em TODAS as páginas (cabeçalho/rodapé). */
  emTodasAsPaginas?: string[];
  /** Códigos de barras que devem ser LIDOS no PNG da 1ª página. */
  codigos?: CodigoEsperado[];
}

export interface Cenario {
  nome: NomeDoCenario;
  descricao: string;
  payload: Record<string, unknown>;
  espera: Expectativa;
}

// ---------------------------------------------------------------------------
// Utilitários de dados de exemplo

function serie<T>(n: number, gerar: (i: number) => T): T[] {
  return Array.from({ length: n }, (_, i) => gerar(i + 1));
}

/** "R$ 1.234,56" — como o pattern `¤ #,##0.00` com locale pt-BR imprime. */
export function moeda(valor: number): string {
  const [inteiro, centavos] = Math.abs(valor).toFixed(2).split('.');
  const milhar = (inteiro ?? '0').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${valor < 0 ? '-' : ''}R$ ${milhar},${centavos ?? '00'}`;
}

const somaCentavos = (valores: number[]): number => Math.round(valores.reduce((a, v) => a + Math.round(v * 100), 0)) / 100;

/** Módulo 10 da linha digitável (pesos 2,1,2… da direita). */
function modulo10(numero: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = numero.length - 1; i >= 0; i--) {
    let p = Number(numero[i]) * peso;
    if (p > 9) p = Math.floor(p / 10) + (p % 10);
    soma += p;
    peso = peso === 2 ? 1 : 2;
  }
  return (10 - (soma % 10)) % 10;
}

/** Módulo 11 com pesos 2..9 da direita (base comum de boleto e chave NF-e). */
function somaModulo11(numero: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = numero.length - 1; i >= 0; i--) {
    soma += Number(numero[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  return soma;
}

/**
 * Código de barras (44) e linha digitável (47, formatada) de um boleto —
 * Circulares BCB 2.531/2.926. Fator de vencimento no ciclo iniciado em
 * 22/02/2025 (fator 1000).
 */
export function boletoDeExemplo(banco: string, vencimento: string, valor: number, campoLivre: string): { codigo: string; linha: string } {
  const dias = Math.round((Date.parse(`${vencimento}T00:00:00Z`) - Date.parse('2025-02-22T00:00:00Z')) / 86_400_000);
  const fator = String(1000 + dias).padStart(4, '0');
  const valorCampo = String(Math.round(valor * 100)).padStart(10, '0');
  const semDv = `${banco}9${fator}${valorCampo}${campoLivre}`; // 43 posições, sem o DV na 5ª
  const resto = 11 - (somaModulo11(semDv) % 11);
  const dv = resto === 0 || resto === 10 || resto === 11 ? 1 : resto;
  const codigo = `${banco}9${dv}${fator}${valorCampo}${campoLivre}`;

  const c1 = `${banco}9${campoLivre.slice(0, 5)}`;
  const c2 = campoLivre.slice(5, 15);
  const c3 = campoLivre.slice(15, 25);
  const bloco = (c: string) => `${c}${modulo10(c)}`;
  const b1 = bloco(c1);
  const b2 = bloco(c2);
  const b3 = bloco(c3);
  const linha = `${b1.slice(0, 5)}.${b1.slice(5)} ${b2.slice(0, 5)}.${b2.slice(5)} ${b3.slice(0, 5)}.${b3.slice(5)} ${dv} ${fator}${valorCampo}`;
  return { codigo, linha };
}

/** Chave de acesso NF-e (44): 43 posições + DV módulo 11. */
export function chaveNfeDeExemplo(cuf: string, aamm: string, cnpj: string, serie: number, numero: number, codigoNumerico: string): string {
  const base = `${cuf}${aamm}${cnpj}55${String(serie).padStart(3, '0')}${String(numero).padStart(9, '0')}1${codigoNumerico}`;
  const resto = somaModulo11(base) % 11;
  return `${base}${resto < 2 ? 0 : 11 - resto}`;
}

const SEM_NULL: Expectativa['ausentes'] = ['null'];

// ---------------------------------------------------------------------------
// Conjunto original (fatura, comprovante, formulário, etiqueta A4)

const ITENS_FATURA = [
  { descricao: 'Revisão elétrica — salão', valor: 1250.5 },
  { descricao: 'Troca de exaustor (peça + mão de obra)', valor: 830 },
  { descricao: 'Manutenção preventiva câmara fria', valor: 415.25 },
];

const FATURA: Cenario[] = [
  {
    nome: 'tipico',
    descricao: 'Fatura com itens, total e entregas pelo subreport "repo:fatura_entregas"',
    payload: {
      titulo: 'Fatura nº 2026-000123',
      categoria: 'Serviços de Manutenção',
      cliente_nome: 'Padaria São João Ltda.',
      itens: ITENS_FATURA,
      total: somaCentavos(ITENS_FATURA.map((i) => i.valor)),
      entregas: [
        { endereco: 'Rua das Flores, 100', previsao: '15/01/2026' },
        { endereco: 'Av. Brasil, 2000', previsao: '16/01/2026' },
      ],
    },
    espera: {
      textos: ['Fatura nº 2026-000123', 'Padaria São João Ltda.', 'Revisão elétrica — salão', 'R$ 1.250,50', 'R$ 2.495,75', 'Entregas de Padaria São João Ltda.', 'Av. Brasil, 2000'],
      ausentes: SEM_NULL,
      paginas: { min: 1, max: 1 },
      codigos: [{ formato: 'QR_CODE', valor: 'Padaria São João Ltda.' }],
    },
  },
  {
    nome: 'minimo',
    descricao: 'Sem itens, total, logo nem entregas — título default do parâmetro',
    payload: { categoria: 'Avulsos', cliente_nome: 'Cliente Avulso', itens: [] },
    espera: { textos: ['Fatura', 'Cliente Avulso'], ausentes: [...(SEM_NULL ?? []), 'Entregas de'], paginas: { min: 1, max: 1 } },
  },
  {
    nome: 'volume',
    descricao: '300 itens: a tabela atravessa várias folhas',
    payload: {
      categoria: 'Materiais',
      cliente_nome: 'Mercado Bom Preço',
      itens: serie(300, (i) => ({ descricao: `Item de material ${i}`, valor: i * 1.5 })),
      total: somaCentavos(serie(300, (i) => i * 1.5)),
    },
    espera: { textos: ['Item de material 1', 'Item de material 300', moeda(somaCentavos(serie(300, (i) => i * 1.5)))], ausentes: SEM_NULL, paginas: { min: 3 } },
  },
];

const COMPROVANTE: Cenario[] = [
  {
    nome: 'tipico',
    descricao: 'Pedido com cliente, itens e QR de conferência',
    payload: {
      pedido: { numero: 'P-2026-042', data: '2026-07-10', qrPayload: 'https://exemplo.com.br/pedidos/P-2026-042' },
      cliente: { nome: 'Açougue Três Irmãos', documento: '12.345.678/0001-99', endereco: 'Av. das Nações, 1500 — São Paulo/SP' },
      itens: [
        { descricao: 'Linguiça artesanal', quantidade: 12.5, unidade: 'kg' },
        { descricao: 'Pão de alho congelado', quantidade: 30, unidade: 'un' },
      ],
    },
    espera: {
      textos: ['P-2026-042', '10/07/2026', 'Açougue Três Irmãos', 'Linguiça artesanal', '12,5'],
      ausentes: SEM_NULL,
      paginas: { min: 1, max: 1 },
      codigos: [{ formato: 'QR_CODE', valor: 'https://exemplo.com.br/pedidos/P-2026-042' }],
    },
  },
  {
    nome: 'minimo',
    descricao: 'Só número, data, cliente e QR — sem itens',
    payload: {
      pedido: { numero: 'P-1', data: '2026-01-02', qrPayload: 'P-1' },
      cliente: { nome: 'Cliente Mínimo', documento: '000.000.000-00' },
      itens: [],
    },
    espera: { textos: ['P-1', '02/01/2026', 'Cliente Mínimo'], paginas: { min: 1, max: 1 } },
  },
  {
    nome: 'textos_longos',
    descricao: 'Endereço muito longo (StretchHeight) e descrições longas',
    payload: {
      pedido: { numero: 'P-2026-777', data: '2026-03-15', qrPayload: 'P-2026-777' },
      cliente: {
        nome: 'Distribuidora de Alimentos Nordeste Sul Sudeste Centro-Oeste e Norte Ltda.',
        documento: '11.222.333/0001-44',
        endereco: 'Rodovia BR-116, km 512, Galpão 7, Setor de Expedição, Bloco C, Doca 14 — Distrito Industrial — Feira de Santana/BA — CEP 44.000-000 — Referência: ao lado do posto fiscal',
      },
      itens: serie(5, (i) => ({ descricao: `Produto com descrição extensa número ${i} — embalagem institucional`, quantidade: i, unidade: 'cx' })),
    },
    espera: { textos: ['Feira de Santana/BA', 'Produto com descrição extensa número 5'], ausentes: SEM_NULL },
  },
];

const FORMULARIO: Cenario[] = [
  {
    nome: 'tipico',
    descricao: 'Ficha completa com data e booleano',
    payload: {
      titulo_ficha: 'Ficha Cadastral de Fornecedor',
      nome: 'João das Couves & Cia.',
      documento: '98.765.432/0001-10',
      nascimento: '1987-03-21',
      ativo: true,
      observacoes: 'Atende às sextas; entrega própria na região.',
    },
    espera: { textos: ['Ficha Cadastral de Fornecedor', 'João das Couves & Cia.', '21/03/1987', 'Ativo'], ausentes: SEM_NULL, paginas: { min: 1, max: 1 } },
  },
  {
    nome: 'minimo',
    descricao: 'Só nome e documento — situação e observações ausentes',
    payload: { nome: 'Maria Souza', documento: '123.456.789-00', nascimento: '1990-12-01' },
    espera: { textos: ['Ficha Cadastral', 'Maria Souza'], ausentes: ['Ativo', 'Inativo'], paginas: { min: 1, max: 1 } },
  },
  {
    nome: 'textos_longos',
    descricao: 'Observações com vários parágrafos (StretchHeight)',
    payload: {
      nome: 'Fornecedor Prolixo',
      documento: '55.666.777/0001-88',
      nascimento: '1975-05-05',
      ativo: false,
      observacoes: serie(40, (i) => `Parágrafo ${i} de observações do cadastro, com condições específicas de entrega e pagamento.`).join('\n'),
    },
    espera: { textos: ['Inativo', 'Parágrafo 1 de observações', 'Parágrafo 40 de observações'], ausentes: SEM_NULL },
  },
];

const ETIQUETA_A4: Cenario[] = [
  {
    nome: 'tipico',
    descricao: '9 etiquetas = grade 3×3 numa folha',
    payload: {
      etiquetas: serie(9, (i) => ({ produto_nome: `Café Torrado Premium ${i}kg`, preco: 34.9 + i, ean: '7891000315507' })),
    },
    espera: {
      textos: ['Café Torrado Premium 1kg', 'Café Torrado Premium 9kg', 'R$ 35,90'],
      paginas: { min: 1, max: 1 },
      codigos: [{ formato: 'EAN_13', valor: '7891000315507' }],
    },
  },
  {
    nome: 'minimo',
    descricao: 'Sem etiquetas → banda noData',
    payload: { etiquetas: [] },
    espera: { textos: ['Sem etiquetas no payload'], paginas: { min: 1, max: 1 } },
  },
  {
    nome: 'volume',
    descricao: '60 etiquetas = 7 folhas (3 colunas × 3 linhas)',
    payload: { etiquetas: serie(60, (i) => ({ produto_nome: `Produto ${i}`, preco: i, ean: '7891000315507' })) },
    espera: { textos: ['Produto 1', 'Produto 60'], paginas: { min: 7, max: 7 } },
  },
];

// ---------------------------------------------------------------------------
// Fiscais / cobrança

const BOLETO_TIPICO = boletoDeExemplo('341', '2026-12-10', 1234.56, '1090000012345678901234567');

const BOLETO: Cenario[] = [
  {
    nome: 'tipico',
    descricao: 'Boleto completo com código de barras e linha digitável calculados a montante',
    payload: {
      banco: { nome: 'Banco Exemplo', codigo: '341-7' },
      beneficiario: { nome: 'Padaria São João Ltda.', documento: '12.345.678/0001-99', agencia_codigo: '1234 / 56789-0' },
      pagador: { nome: 'Açougue Três Irmãos', documento: '98.765.432/0001-10', endereco: 'Av. das Nações, 1500 — São Paulo/SP — 01234-000' },
      linha_digitavel: BOLETO_TIPICO.linha,
      codigo_barras: BOLETO_TIPICO.codigo,
      vencimento: '2026-12-10',
      valor: 1234.56,
      nosso_numero: '109/00001234-5',
      numero_documento: 'NF 4567',
      data_documento: '2026-11-27',
      especie_documento: 'DM',
      aceite: 'N',
      carteira: '109',
      local_pagamento: 'Pagável em qualquer banco até o vencimento',
      instrucoes: 'Após o vencimento cobrar multa de 2% e juros de 1% ao mês.\nNão receber após 30 dias do vencimento.',
    },
    espera: {
      textos: ['Recibo do Pagador', 'FICHA DE COMPENSAÇÃO', BOLETO_TIPICO.linha, '10/12/2026', 'R$ 1.234,56', 'Açougue Três Irmãos', 'multa de 2%'],
      ausentes: SEM_NULL,
      paginas: { min: 1, max: 1 },
      codigos: [{ formato: 'ITF', valor: BOLETO_TIPICO.codigo }],
    },
  },
  {
    nome: 'minimo',
    descricao: 'Só o que o banco exige para pagar: beneficiário, pagador, valor, vencimento e códigos',
    payload: {
      banco: { nome: 'Banco Exemplo', codigo: '341-7' },
      beneficiario: { nome: 'Beneficiário', documento: '00.000.000/0001-00' },
      pagador: { nome: 'Pagador', documento: '000.000.000-00' },
      linha_digitavel: BOLETO_TIPICO.linha,
      codigo_barras: BOLETO_TIPICO.codigo,
      vencimento: '2026-12-10',
      valor: 1234.56,
    },
    espera: { textos: ['Recibo do Pagador', BOLETO_TIPICO.linha], ausentes: SEM_NULL, paginas: { min: 1, max: 1 }, codigos: [{ formato: 'ITF', valor: BOLETO_TIPICO.codigo }] },
  },
];

const CHAVE_DANFE = chaveNfeDeExemplo('35', '2611', '12345678000199', 1, 4567, '12345678');

function danfe(produtos: number): Record<string, unknown> {
  const itens = serie(produtos, (i) => ({
    codigo: `P${String(i).padStart(5, '0')}`,
    descricao: `Produto ${i} — descrição comercial`,
    ncm: '21069090',
    cfop: '5102',
    unidade: 'UN',
    quantidade: i % 7 + 1,
    valor_unitario: 10 + i / 10,
    valor_total: (i % 7 + 1) * (10 + i / 10),
  }));
  const total = somaCentavos(itens.map((i) => i.valor_total));
  return {
    chave_acesso: CHAVE_DANFE,
    numero: '000.004.567',
    serie: '001',
    tipo_operacao: '1',
    natureza_operacao: 'VENDA DE MERCADORIA',
    protocolo: '135260000012345 27/11/2026 10:15:00',
    data_emissao: '2026-11-27',
    data_saida: '2026-11-27',
    emitente: { nome: 'Indústria de Alimentos Exemplo S.A.', endereco: 'Rua da Fábrica, 10 — Distrito Industrial — Campinas/SP — 13000-000', cnpj: '12.345.678/0001-99', ie: '123.456.789.110' },
    destinatario: { nome: 'Supermercado Bom Preço Ltda.', documento: '98.765.432/0001-10', endereco: 'Av. Central, 500', municipio: 'São Paulo', uf: 'SP', ie: '987.654.321.000', telefone: '(11) 3333-4444' },
    impostos: { base_icms: total, valor_icms: Math.round(total * 18) / 100, valor_produtos: total, valor_frete: 0, valor_total: total },
    transportador: { nome: 'Transportadora Rápida Ltda.', modalidade_frete: '0 - Emitente' },
    produtos: itens,
    informacoes_complementares: 'Documento emitido por ME ou EPP optante pelo Simples Nacional.',
  };
}

const DANFE: Cenario[] = [
  {
    nome: 'tipico',
    descricao: 'DANFE de 1 folha: chave legível em CODE-128 e impressa em 11 blocos',
    payload: danfe(8),
    espera: {
      textos: ['DANFE', 'CHAVE DE ACESSO', CHAVE_DANFE.replace(/(.{4})/g, '$1 ').trim(), 'Supermercado Bom Preço Ltda.', 'Produto 8 — descrição comercial', 'RECEBEMOS DE Indústria de Alimentos Exemplo S.A.'],
      ausentes: SEM_NULL,
      paginas: { min: 1, max: 1 },
      codigos: [{ formato: 'CODE_128', valor: CHAVE_DANFE }],
    },
  },
  {
    nome: 'minimo',
    descricao: 'Sem produtos, transportador nem informações complementares',
    payload: {
      chave_acesso: CHAVE_DANFE,
      numero: '1',
      serie: '1',
      tipo_operacao: '1',
      natureza_operacao: 'VENDA',
      emitente: { nome: 'Emitente' },
      destinatario: { nome: 'Destinatário' },
      produtos: [],
    },
    espera: { textos: ['DANFE', 'Emitente', 'Destinatário'], ausentes: SEM_NULL, paginas: { min: 1, max: 1 }, codigos: [{ formato: 'CODE_128', valor: CHAVE_DANFE }] },
  },
  {
    nome: 'volume',
    descricao: '150 produtos: várias folhas, emitente e chave repetidos em todas',
    payload: danfe(150),
    espera: {
      textos: ['Produto 1 — descrição comercial', 'Produto 150 — descrição comercial'],
      ausentes: SEM_NULL,
      paginas: { min: 3 },
      emTodasAsPaginas: ['CHAVE DE ACESSO', 'Indústria de Alimentos Exemplo S.A.'],
    },
  },
];

const ITENS_ORCAMENTO = [
  { descricao: 'Forno combinado 10 GN', quantidade: 1, unidade: 'un', preco_unitario: 48900 },
  { descricao: 'Instalação e start-up', quantidade: 1, unidade: 'sv', preco_unitario: 1800 },
  { descricao: 'Assadeira inox 1/1', quantidade: 12, unidade: 'un', preco_unitario: 189.9 },
];
const SUBTOTAL_ORCAMENTO = somaCentavos(ITENS_ORCAMENTO.map((i) => i.quantidade * i.preco_unitario));

const ORCAMENTO: Cenario[] = [
  {
    nome: 'tipico',
    descricao: 'Orçamento com itens, total por linha calculado no template e totais do payload',
    payload: {
      numero: 'ORC-2026-0310',
      emissao: '2026-11-27',
      validade: '2026-12-27',
      vendedor: 'Carla Mendes',
      empresa: { nome: 'Cozinhas Profissionais Ltda.', contato: 'vendas@cozinhas.example · (11) 4000-1234' },
      cliente: { nome: 'Restaurante Sabor da Terra', documento: '33.444.555/0001-66', contato: 'Sr. Paulo' },
      itens: ITENS_ORCAMENTO,
      subtotal: SUBTOTAL_ORCAMENTO,
      desconto: 500,
      total: SUBTOTAL_ORCAMENTO - 500,
      condicoes: 'Pagamento: 30% na aprovação e saldo em 3x. Prazo de entrega: 20 dias úteis. Garantia de 12 meses.',
    },
    espera: {
      textos: ['ORÇAMENTO', 'Nº ORC-2026-0310', 'R$ 2.278,80', moeda(SUBTOTAL_ORCAMENTO), moeda(SUBTOTAL_ORCAMENTO - 500), '27/12/2026', 'Garantia de 12 meses'],
      ausentes: SEM_NULL,
      paginas: { min: 1, max: 1 },
    },
  },
  {
    nome: 'minimo',
    descricao: 'Sem itens, totais nem condições',
    payload: { numero: 'ORC-1', empresa: { nome: 'Empresa' }, cliente: { nome: 'Cliente' }, itens: [] },
    espera: { textos: ['ORÇAMENTO', 'Nº ORC-1'], ausentes: SEM_NULL, paginas: { min: 1, max: 1 } },
  },
  {
    nome: 'textos_longos',
    descricao: 'Condições comerciais longas (StretchHeight no summary)',
    payload: {
      numero: 'ORC-2026-0999',
      empresa: { nome: 'Empresa' },
      cliente: { nome: 'Cliente' },
      itens: ITENS_ORCAMENTO,
      condicoes: serie(30, (i) => `${i}. Condição comercial detalhada número ${i}, aplicável a todo o fornecimento.`).join('\n'),
    },
    espera: { textos: ['1. Condição comercial detalhada número 1', '30. Condição comercial detalhada número 30'], ausentes: SEM_NULL },
  },
];

// ---------------------------------------------------------------------------
// Gerenciais

const VENDEDORES = ['Ana Lima', 'Bruno Costa', 'Carla Mendes', 'Diego Rocha', 'Elisa Prado', 'Fábio Nunes'];

function vendas(porVendedor: number): Array<Record<string, unknown>> {
  return VENDEDORES.flatMap((vendedor, v) =>
    serie(porVendedor, (i) => ({
      vendedor,
      data: `2026-11-${String((i % 28) + 1).padStart(2, '0')}`,
      cliente: `Cliente ${v + 1}-${i}`,
      produto: `Produto ${i % 9}`,
      quantidade: (i % 5) + 1,
      valor: Math.round((100 + v * 10 + i * 3.25) * 100) / 100,
    })),
  );
}

const VENDAS_TIPICO = vendas(4);
const VENDAS_VOLUME = vendas(100);
const valorDe = (vs: Array<Record<string, unknown>>) => somaCentavos(vs.map((v) => v['valor'] as number));

const LISTAGEM_VENDAS: Cenario[] = [
  {
    nome: 'tipico',
    descricao: '6 vendedores × 4 vendas: subtotais por vendedor e total geral',
    payload: { empresa: 'Distribuidora Exemplo', periodo: 'novembro/2026', vendas: VENDAS_TIPICO },
    espera: {
      textos: ['Distribuidora Exemplo', 'Período: novembro/2026', 'Vendedor: Ana Lima', 'Vendedor: Fábio Nunes', moeda(valorDe(VENDAS_TIPICO.slice(0, 4))), 'Total geral', moeda(valorDe(VENDAS_TIPICO)), '24 venda(s) no período'],
      ausentes: SEM_NULL,
      paginas: { min: 1, max: 1 },
    },
  },
  {
    nome: 'minimo',
    descricao: 'Sem vendas → banda noData',
    payload: { vendas: [] },
    espera: { textos: ['Nenhuma venda no período'], paginas: { min: 1, max: 1 } },
  },
  {
    nome: 'volume',
    descricao: '600 vendas: cabeçalho de coluna e numeração em todas as folhas',
    payload: { periodo: '2026', vendas: VENDAS_VOLUME },
    espera: {
      textos: ['Relatório de vendas', moeda(valorDe(VENDAS_VOLUME)), '600 venda(s) no período'],
      ausentes: SEM_NULL,
      paginas: { min: 10 },
      emTodasAsPaginas: ['Cliente', 'Produto', 'Página'],
    },
  },
];

function lancamentos(n: number): Array<Record<string, unknown>> {
  return serie(n, (i) => ({
    data: `2026-11-${String((i % 28) + 1).padStart(2, '0')}`,
    historico: i % 3 === 0 ? `PIX recebido — cliente ${i}` : `Pagamento fornecedor ${i}`,
    documento: `DOC${String(i).padStart(6, '0')}`,
    valor: i % 3 === 0 ? 350 + i : -(40 + i / 4),
  }));
}

const LANC_TIPICO = lancamentos(12);
const LANC_VOLUME = lancamentos(400);
const saldoFinal = (anterior: number, ls: Array<Record<string, unknown>>) => somaCentavos([anterior, ...ls.map((l) => l['valor'] as number)]);

const EXTRATO_CONTA: Cenario[] = [
  {
    nome: 'tipico',
    descricao: 'Créditos e débitos com saldo acumulado a partir do saldo anterior',
    payload: { titular: 'Padaria São João Ltda.', agencia: '1234', conta: '56789-0', periodo: '01/11/2026 a 30/11/2026', saldo_anterior: 1500, lancamentos: LANC_TIPICO },
    espera: {
      textos: ['Extrato de conta corrente', 'Agência 1234 · Conta 56789-0', 'R$ 1.500,00', 'PIX recebido — cliente 3', 'Saldo final', moeda(saldoFinal(1500, LANC_TIPICO))],
      ausentes: SEM_NULL,
      paginas: { min: 1, max: 1 },
    },
  },
  {
    nome: 'minimo',
    descricao: 'Sem lançamentos → banda noData',
    payload: { lancamentos: [] },
    espera: { textos: ['Sem lançamentos no período'], paginas: { min: 1, max: 1 } },
  },
  {
    nome: 'volume',
    descricao: '400 lançamentos sem saldo anterior (default ZERO)',
    payload: { titular: 'Conta de Volume', agencia: '1', conta: '2', lancamentos: LANC_VOLUME },
    espera: { textos: ['Saldo final', moeda(saldoFinal(0, LANC_VOLUME)), 'DOC000400'], ausentes: SEM_NULL, paginas: { min: 6 }, emTodasAsPaginas: ['Histórico', 'Página'] },
  },
];

// ---------------------------------------------------------------------------
// Etiquetas / crachás

const ETIQUETA_PRODUTO_QR: Cenario[] = [
  {
    nome: 'tipico',
    descricao: '8 etiquetas de produto com QR',
    payload: {
      produtos: serie(8, (i) => ({ nome: `Azeite Extra Virgem ${i * 250}ml`, sku: `AZ-${1000 + i}`, preco: 19.9 + i, lote: `L26${i}`, qr: `https://loja.example/p/AZ-${1000 + i}` })),
    },
    espera: {
      textos: ['Azeite Extra Virgem 250ml', 'SKU AZ-1001', 'R$ 20,90', 'Lote L261'],
      ausentes: SEM_NULL,
      paginas: { min: 1, max: 1 },
      codigos: [{ formato: 'QR_CODE', valor: 'https://loja.example/p/AZ-1001' }],
    },
  },
  {
    nome: 'minimo',
    descricao: 'Sem preço nem lote',
    payload: { produtos: [{ nome: 'Produto sem preço', sku: 'X-1', qr: 'X-1' }] },
    espera: { textos: ['Produto sem preço', 'SKU X-1'], ausentes: SEM_NULL, paginas: { min: 1, max: 1 }, codigos: [{ formato: 'QR_CODE', valor: 'X-1' }] },
  },
  {
    nome: 'volume',
    descricao: '100 etiquetas = 4 folhas (4 colunas × 8 linhas)',
    payload: { produtos: serie(100, (i) => ({ nome: `Produto ${i}`, sku: `S${i}`, preco: i, qr: `S${i}` })) },
    espera: { textos: ['Produto 1', 'Produto 100'], ausentes: SEM_NULL, paginas: { min: 4, max: 4 } },
  },
];

const ETIQUETA_ENDERECAMENTO: Cenario[] = [
  {
    nome: 'tipico',
    descricao: '4 envios com rastreio CODE-128',
    payload: {
      envios: serie(4, (i) => ({
        destinatario_nome: `Cliente Destino ${i}`,
        destinatario_endereco: `Rua das Acácias, ${i * 100} — Apto ${i}1\nJardim Primavera — Belo Horizonte/MG`,
        destinatario_cep: `30${i}40-000`,
        remetente_nome: 'Loja Exemplo Ltda.',
        remetente_endereco: 'Av. Paulista, 1000 — São Paulo/SP — 01310-100',
        rastreio: `BR${String(123456780 + i)}BR`,
      })),
    },
    espera: {
      textos: ['DESTINATÁRIO', 'Cliente Destino 1', 'CEP 30140-000', 'Belo Horizonte/MG', 'REMETENTE', 'Loja Exemplo Ltda.'],
      ausentes: SEM_NULL,
      paginas: { min: 1, max: 1 },
      codigos: [{ formato: 'CODE_128', valor: 'BR123456781BR' }],
    },
  },
  {
    nome: 'minimo',
    descricao: 'Sem remetente',
    payload: { envios: [{ destinatario_nome: 'Destino', destinatario_endereco: 'Rua 1', destinatario_cep: '01000-000', rastreio: 'BR000000001BR' }] },
    espera: { textos: ['Destino', 'CEP 01000-000'], ausentes: SEM_NULL, paginas: { min: 1, max: 1 }, codigos: [{ formato: 'CODE_128', valor: 'BR000000001BR' }] },
  },
  {
    nome: 'volume',
    descricao: '20 envios = 3 folhas (2 colunas × 4 linhas)',
    payload: { envios: serie(20, (i) => ({ destinatario_nome: `Destino ${i}`, destinatario_endereco: 'Rua 1', destinatario_cep: '01000-000', rastreio: `BR${i}` })) },
    espera: { textos: ['Destino 1', 'Destino 20'], ausentes: SEM_NULL, paginas: { min: 3, max: 3 } },
  },
];

const CRACHA: Cenario[] = [
  {
    nome: 'tipico',
    descricao: '4 crachás; foto inexistente cai em branco (onErrorType=Blank)',
    payload: {
      empresa: 'Hospital Exemplo',
      pessoas: serie(4, (i) => ({
        nome: ['Ana Beatriz Lima', 'João Pedro Souza', 'Mariana Alves', 'Rafael Gonçalves'][i - 1],
        cargo: 'Enfermeiro(a)',
        setor: 'UTI Adulto',
        matricula: `M${2026000 + i}`,
        foto_url: 'inexistente.png',
        qr: `M${2026000 + i}`,
      })),
    },
    espera: {
      textos: ['Hospital Exemplo', 'Ana Beatriz Lima', 'Rafael Gonçalves', 'Matrícula M2026001', 'UTI Adulto'],
      ausentes: SEM_NULL,
      paginas: { min: 1, max: 1 },
      codigos: [{ formato: 'QR_CODE', valor: 'M2026001' }],
    },
  },
  {
    nome: 'minimo',
    descricao: 'Sem foto, cargo nem setor; empresa pelo default do parâmetro',
    payload: { pessoas: [{ nome: 'Visitante', matricula: 'V1', qr: 'V1' }] },
    espera: { textos: ['Empresa', 'Visitante', 'Matrícula V1'], ausentes: SEM_NULL, paginas: { min: 1, max: 1 }, codigos: [{ formato: 'QR_CODE', valor: 'V1' }] },
  },
  {
    nome: 'volume',
    descricao: '13 crachás = 3 folhas (2 colunas × 3 linhas)',
    payload: { pessoas: serie(13, (i) => ({ nome: `Pessoa ${i}`, matricula: `M${i}`, qr: `M${i}` })) },
    espera: { textos: ['Pessoa 1', 'Pessoa 13'], ausentes: SEM_NULL, paginas: { min: 3, max: 3 } },
  },
];

// ---------------------------------------------------------------------------
// Cartas / documentos

const CARTA: Cenario[] = [
  {
    nome: 'tipico',
    descricao: 'Declaração de uma folha com data por extenso',
    payload: {
      empresa: 'Escola Exemplo',
      empresa_endereco: 'Rua do Saber, 100 — Curitiba/PR',
      rodape: 'Escola Exemplo · CNPJ 12.345.678/0001-99',
      local: 'Curitiba',
      data: '2026-11-27',
      destinatario: 'A quem possa interessar',
      assunto: 'Declaração de matrícula',
      corpo: 'Declaramos, para os devidos fins, que Joana Prado está regularmente matriculada no 9º ano do Ensino Fundamental nesta instituição no ano letivo de 2026.',
      signatario: { nome: 'Helena Duarte', cargo: 'Secretária Escolar' },
    },
    espera: {
      textos: ['Escola Exemplo', 'Curitiba, 27 de novembro de 2026', 'Assunto: Declaração de matrícula', 'regularmente matriculada', 'Atenciosamente,', 'Helena Duarte'],
      ausentes: SEM_NULL,
      paginas: { min: 1, max: 1 },
    },
  },
  {
    nome: 'minimo',
    descricao: 'Sem endereço, rodapé, destinatário nem signatário',
    payload: { local: 'Recife', data: '2026-01-05', assunto: 'Aviso', corpo: 'Texto curto.' },
    espera: { textos: ['Empresa', 'Recife, 5 de janeiro de 2026', 'Assunto: Aviso'], ausentes: SEM_NULL, paginas: { min: 1, max: 1 } },
  },
  {
    nome: 'textos_longos',
    descricao: 'Corpo com 25 parágrafos: atravessa folhas e a assinatura vem depois do texto',
    payload: {
      local: 'Porto Alegre',
      data: '2026-06-30',
      assunto: 'Relatório circunstanciado',
      corpo: serie(25, (i) => `Parágrafo ${i}. ` + 'Este parágrafo descreve com detalhes os fatos apurados, as providências adotadas e os próximos passos acordados entre as partes. '.repeat(3)).join('\n\n'),
      signatario: { nome: 'Responsável', cargo: 'Diretor' },
    },
    espera: { textos: ['Parágrafo 1.', 'Parágrafo 25.', 'Atenciosamente,', 'Responsável'], ausentes: SEM_NULL, paginas: { min: 2 } },
  },
];

function clausulas(n: number, repeticoes: number): Array<Record<string, unknown>> {
  return serie(n, (i) => ({
    numero: i,
    titulo: ['DO OBJETO', 'DO PRAZO', 'DO PREÇO', 'DAS OBRIGAÇÕES', 'DA RESCISÃO', 'DO FORO'][(i - 1) % 6],
    texto: `${i}.1. ` + 'A CONTRATADA prestará os serviços descritos com zelo e diligência, observando as normas técnicas aplicáveis e os prazos acordados. '.repeat(repeticoes),
  }));
}

const PARTES = { numero_contrato: 'CT-2026-0042', contratante: 'Padaria São João Ltda.', contratada: 'Manutenção Total ME', cidade: 'São Paulo', data_assinatura: '2026-11-27' };

const CONTRATO: Cenario[] = [
  {
    nome: 'tipico',
    descricao: '6 cláusulas, partes e assinaturas',
    payload: { ...PARTES, clausulas: clausulas(6, 2) },
    espera: {
      textos: ['CONTRATO DE PRESTAÇÃO DE SERVIÇOS', 'Contrato nº CT-2026-0042', 'CONTRATANTE: Padaria São João Ltda.', 'CLÁUSULA 1 — DO OBJETO', 'CLÁUSULA 6 — DO FORO', 'São Paulo, 27 de novembro de 2026', 'Testemunha 2'],
      ausentes: SEM_NULL,
    },
  },
  {
    nome: 'minimo',
    descricao: 'Sem cláusulas → banda noData',
    payload: { ...PARTES, clausulas: [] },
    espera: { textos: ['Contrato sem cláusulas no payload'], paginas: { min: 1, max: 1 } },
  },
  {
    nome: 'textos_longos',
    descricao: '30 cláusulas longas: várias folhas com cabeçalho e rubrica em todas',
    payload: { ...PARTES, clausulas: clausulas(30, 6) },
    espera: {
      textos: ['CLÁUSULA 30 — DO FORO', 'CONTRATADA'],
      ausentes: SEM_NULL,
      paginas: { min: 4 },
      emTodasAsPaginas: ['Contrato nº CT-2026-0042', 'Rubricas', 'Página'],
    },
  },
];

/**
 * Cenários por chave de `REFERENCE_TEMPLATES`. `fatura_entregas` não tem
 * cenário próprio: é subreport (ADR-020) e é exercitado pela fatura.
 */
export const CENARIOS: Record<string, Cenario[]> = {
  fatura: FATURA,
  fatura_entregas: [],
  comprovante: COMPROVANTE,
  formulario: FORMULARIO,
  etiqueta_a4: ETIQUETA_A4,
  boleto: BOLETO,
  danfe: DANFE,
  orcamento: ORCAMENTO,
  listagem_vendas: LISTAGEM_VENDAS,
  extrato_conta: EXTRATO_CONTA,
  etiqueta_produto_qr: ETIQUETA_PRODUTO_QR,
  etiqueta_enderecamento: ETIQUETA_ENDERECAMENTO,
  cracha: CRACHA,
  carta_declaracao: CARTA,
  contrato: CONTRATO,
};
