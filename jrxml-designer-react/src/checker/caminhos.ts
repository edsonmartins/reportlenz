/**
 * Navegação do ReportChecker (tarefa phase-2/6.1): converte o `path` das
 * mensagens do core (espaço de MODELO, ex.: `bands/detail[0]/elements[1]`)
 * em caminho de seleção do canvas. Problemas de contrato/estilos não têm
 * elemento — retornam null (linha não navegável).
 */
import type { ReportTemplate } from '@reportlenz/jrxml-core';
import type { CaminhoDeElemento, SecaoUnica } from '../store/documentoStore';

const SECOES: SecaoUnica[] = [
  'title',
  'background',
  'pageHeader',
  'columnHeader',
  'columnFooter',
  'pageFooter',
  'summary',
  'noData',
];

/** Extrai o caminho de elemento navegável de um path de problema, se houver. */
export function caminhoDoProblema(template: ReportTemplate, path: string): CaminhoDeElemento | null {
  // Seções únicas: bands/title/elements[2]...
  const secao = /^bands\/(\w+)\/elements\[(\d+)\]/.exec(path);
  if (secao && (SECOES as string[]).includes(secao[1]!)) {
    return { banda: { tipo: 'secao', secao: secao[1] as SecaoUnica }, indice: Number(secao[2]) };
  }

  // Detail: bands/detail[0]/elements[1]...
  const detail = /^bands\/detail\[(\d+)\]\/elements\[(\d+)\]/.exec(path);
  if (detail) {
    return { banda: { tipo: 'detail', indice: Number(detail[1]) }, indice: Number(detail[2]) };
  }

  // Grupos: bands/groups[0]/header/elements[0]... (índice → nome do grupo)
  const grupo = /^bands\/groups\[(\d+)\]\/(header|footer)\/elements\[(\d+)\]/.exec(path);
  if (grupo) {
    const nome = template.bands.groups[Number(grupo[1])]?.name;
    if (!nome) return null;
    return {
      banda: { tipo: 'grupo', nome, parte: grupo[2] as 'header' | 'footer' },
      indice: Number(grupo[3]),
    };
  }

  return null;
}
