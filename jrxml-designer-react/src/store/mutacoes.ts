/**
 * Mutações do documento (tarefa phase-2/2.2 em diante): funções puras
 * `ReportTemplate → ReportTemplate` para usar com `mutarTemplate` — cada uma
 * passa automaticamente pela validação contínua (1.2).
 */
import type { Band, Bounds, Element, ReportTemplate } from '@reportlenz/jrxml-core';
import { alturaMinimaDaBanda } from '../canvas/bandas';
import type { CaminhoDeBanda, CaminhoDeElemento } from './documentoStore';

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

/** Aplica `atualizar` ao elemento no caminho, imutavelmente (tarefa 2.3). */
export function comElemento(
  template: ReportTemplate,
  caminho: CaminhoDeElemento,
  atualizar: (elemento: Element) => Element,
): ReportTemplate {
  return comBanda(template, caminho.banda, (banda) => {
    const elemento = banda.elements[caminho.indice];
    if (!elemento) return banda;
    const elements = banda.elements.slice();
    elements[caminho.indice] = atualizar(elemento);
    return { ...banda, elements };
  });
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * Move/redimensiona um elemento (2.3), CLAMPEADO dentro da banda: o engine
 * recusa elemento fora dos limites (largura da coluna × altura da banda).
 * Tamanho mínimo 1pt.
 */
export function atualizarBoundsDoElemento(caminho: CaminhoDeElemento, bounds: Bounds) {
  return (template: ReportTemplate): ReportTemplate => {
    const larguraBanda = template.pageFormat.columnWidth;
    return comBanda(template, caminho.banda, (banda) => {
      const elemento = banda.elements[caminho.indice];
      if (!elemento) return banda;

      const width = clamp(Math.round(bounds.width), 1, larguraBanda);
      const height = clamp(Math.round(bounds.height), 1, Math.max(1, banda.height));
      const ajustado: Bounds = {
        width,
        height,
        x: clamp(Math.round(bounds.x), 0, Math.max(0, larguraBanda - width)),
        y: clamp(Math.round(bounds.y), 0, Math.max(0, banda.height - height)),
      };

      const elements = banda.elements.slice();
      elements[caminho.indice] = { ...elemento, bounds: ajustado };
      return { ...banda, elements };
    });
  };
}
