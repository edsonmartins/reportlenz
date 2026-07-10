/**
 * Empilhamento de bandas na página (RFC-004 §2-§3, tarefa phase-2/2.2).
 *
 * Ordem de design view (como o Jaspersoft Studio): title → pageHeader →
 * columnHeader → cabeçalhos de grupo (na ordem) → detail[] → rodapés de
 * grupo (ordem inversa) → columnFooter → pageFooter → summary → noData →
 * background. Tudo em pt absoluto na página, a partir do topo da área útil.
 */
import type { Band, ReportTemplate } from '@reportlenz/jrxml-core';
import type { CaminhoDeBanda, SecaoUnica } from '../store/documentoStore';
import { areaUtil } from './geometria';

export interface FaixaDeBanda {
  caminho: CaminhoDeBanda;
  rotulo: string;
  /** Topo da faixa em pt (absoluto na página). */
  yPt: number;
  alturaPt: number;
  banda: Band;
}

const ROTULO_DE_SECAO: Record<SecaoUnica, string> = {
  title: 'Título',
  pageHeader: 'Cabeçalho de página',
  columnHeader: 'Cabeçalho de coluna',
  columnFooter: 'Rodapé de coluna',
  pageFooter: 'Rodapé de página',
  summary: 'Sumário',
  noData: 'Sem dados',
  background: 'Fundo',
};

export function chaveDaBanda(caminho: CaminhoDeBanda): string {
  return caminho.tipo === 'secao'
    ? caminho.secao
    : caminho.tipo === 'detail'
      ? `detail[${caminho.indice}]`
      : `grupo:${caminho.nome}:${caminho.parte}`;
}

export function faixasDeBandas(template: ReportTemplate): FaixaDeBanda[] {
  const faixas: FaixaDeBanda[] = [];
  let y = areaUtil(template.pageFormat).y;

  const empilhar = (caminho: CaminhoDeBanda, rotulo: string, banda: Band | undefined) => {
    if (!banda) return;
    faixas.push({ caminho, rotulo, yPt: y, alturaPt: banda.height, banda });
    y += banda.height;
  };

  const secao = (s: SecaoUnica) => empilhar({ tipo: 'secao', secao: s }, ROTULO_DE_SECAO[s], template.bands[s]);

  secao('title');
  secao('pageHeader');
  secao('columnHeader');
  for (const grupo of template.bands.groups) {
    empilhar({ tipo: 'grupo', nome: grupo.name, parte: 'header' }, `Grupo ${grupo.name} · cabeçalho`, grupo.header);
  }
  template.bands.detail.forEach((banda, i) =>
    empilhar(
      { tipo: 'detail', indice: i },
      template.bands.detail.length > 1 ? `Detalhe ${i + 1}` : 'Detalhe',
      banda,
    ),
  );
  for (const grupo of [...template.bands.groups].reverse()) {
    empilhar({ tipo: 'grupo', nome: grupo.name, parte: 'footer' }, `Grupo ${grupo.name} · rodapé`, grupo.footer);
  }
  secao('columnFooter');
  secao('pageFooter');
  secao('summary');
  secao('noData');
  secao('background');

  return faixas;
}

/** Altura mínima de uma banda: o rodapé do elemento mais baixo (JR recusa menos). */
export function alturaMinimaDaBanda(banda: Band): number {
  return banda.elements.reduce((max, el) => Math.max(max, el.bounds.y + el.bounds.height), 0);
}
