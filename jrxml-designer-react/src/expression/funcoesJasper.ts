/**
 * Catálogo de funções do `jasperreports-functions` (tarefa phase-3/1.3) para
 * autocomplete do expression editor. Subconjunto útil pt-BR; a lista completa
 * vive na dependência do render-service (já na matriz, nota 004).
 */
export interface FuncaoJasper {
  nome: string;
  assinatura: string;
  descricao: string;
}

export const FUNCOES_JASPER: FuncaoJasper[] = [
  { nome: 'msg', assinatura: 'msg(padrão, arg0, ...)', descricao: 'Formata mensagem (java.text.MessageFormat)' },
  { nome: 'str', assinatura: 'str(chave)', descricao: 'Texto do resource bundle' },
  { nome: 'TODAY', assinatura: 'TODAY()', descricao: 'Data de hoje' },
  { nome: 'NOW', assinatura: 'NOW()', descricao: 'Data e hora atuais' },
  { nome: 'YEAR', assinatura: 'YEAR(data)', descricao: 'Ano de uma data' },
  { nome: 'MONTH', assinatura: 'MONTH(data)', descricao: 'Mês de uma data (1-12)' },
  { nome: 'DAY', assinatura: 'DAY(data)', descricao: 'Dia do mês de uma data' },
  { nome: 'DATE', assinatura: 'DATE(ano, mês, dia)', descricao: 'Constrói uma data' },
  { nome: 'DATEFORMAT', assinatura: 'DATEFORMAT(data, "dd/MM/yyyy")', descricao: 'Formata data com padrão' },
  { nome: 'DAYS', assinatura: 'DAYS(inicio, fim)', descricao: 'Dias entre duas datas' },
  { nome: 'UPPER', assinatura: 'UPPER(texto)', descricao: 'Maiúsculas' },
  { nome: 'LOWER', assinatura: 'LOWER(texto)', descricao: 'Minúsculas' },
  { nome: 'TRIM', assinatura: 'TRIM(texto)', descricao: 'Remove espaços das pontas' },
  { nome: 'LEFT', assinatura: 'LEFT(texto, n)', descricao: 'N primeiros caracteres' },
  { nome: 'RIGHT', assinatura: 'RIGHT(texto, n)', descricao: 'N últimos caracteres' },
  { nome: 'REPLACE', assinatura: 'REPLACE(texto, de, para)', descricao: 'Substituição de texto' },
  { nome: 'CONCATENATE', assinatura: 'CONCATENATE(a, b, ...)', descricao: 'Concatena textos' },
  { nome: 'IF', assinatura: 'IF(condição, seVerdade, seFalso)', descricao: 'Condicional' },
  { nome: 'EQUALS', assinatura: 'EQUALS(a, b)', descricao: 'Igualdade null-safe' },
  { nome: 'CURRENCY_SYMBOL', assinatura: 'CURRENCY_SYMBOL()', descricao: 'Símbolo da moeda do locale (R$)' },
];
