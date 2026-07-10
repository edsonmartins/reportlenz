/**
 * Mutações do documento (tarefa phase-2/2.2 em diante): funções puras
 * `ReportTemplate → ReportTemplate` para usar com `mutarTemplate` — cada uma
 * passa automaticamente pela validação contínua (1.2).
 */
import type { Band, ReportTemplate } from '@reportlenz/jrxml-core';
import { alturaMinimaDaBanda } from '../canvas/bandas';
import type { CaminhoDeBanda } from './documentoStore';

/** Aplica `atualizar` à banda no caminho, imutavelmente. */
export function comBanda(
  template: ReportTemplate,
  caminho: CaminhoDeBanda,
  atualizar: (banda: Band) => Band,
): ReportTemplate {
  const bands = template.bands;
  switch (caminho.tipo) {
    case 'secao': {
      const banda = bands[caminho.secao];
      if (!banda) return template;
      return { ...template, bands: { ...bands, [caminho.secao]: atualizar(banda) } };
    }
    case 'detail': {
      const banda = bands.detail[caminho.indice];
      if (!banda) return template;
      const detail = bands.detail.slice();
      detail[caminho.indice] = atualizar(banda);
      return { ...template, bands: { ...bands, detail } };
    }
    case 'grupo': {
      const groups = bands.groups.map((g) => {
        if (g.name !== caminho.nome) return g;
        const banda = caminho.parte === 'header' ? g.header : g.footer;
        if (!banda) return g;
        return { ...g, [caminho.parte]: atualizar(banda) };
      });
      return { ...template, bands: { ...bands, groups } };
    }
  }
}

/**
 * Resize de altura de banda (2.2). A altura nunca fica menor que o rodapé do
 * elemento mais baixo — o engine recusa elemento vazando da banda.
 */
export function redimensionarBanda(caminho: CaminhoDeBanda, novaAlturaPt: number) {
  return (template: ReportTemplate): ReportTemplate =>
    comBanda(template, caminho, (banda) => ({
      ...banda,
      height: Math.round(Math.max(alturaMinimaDaBanda(banda), novaAlturaPt)),
    }));
}
