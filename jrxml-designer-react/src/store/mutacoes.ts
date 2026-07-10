/**
 * Mutações do documento (tarefa phase-2/2.2 em diante): funções puras
 * `ReportTemplate → ReportTemplate` para usar com `mutarTemplate` — cada uma
 * passa automaticamente pela validação contínua (1.2).
 */
import type { Band, Bounds, Element, ReportTemplate } from '@reportlenz/jrxml-core';
import { alturaMinimaDaBanda, chaveDaBanda } from '../canvas/bandas';
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

/** Prende bounds dentro da banda (largura da coluna × altura da banda; mínimo 1pt). */
function clampNaBanda(bounds: Bounds, banda: Band, larguraBandaPt: number): Bounds {
  const width = clamp(Math.round(bounds.width), 1, larguraBandaPt);
  const height = clamp(Math.round(bounds.height), 1, Math.max(1, banda.height));
  return {
    width,
    height,
    x: clamp(Math.round(bounds.x), 0, Math.max(0, larguraBandaPt - width)),
    y: clamp(Math.round(bounds.y), 0, Math.max(0, banda.height - height)),
  };
}

/**
 * Move/redimensiona um elemento (2.3), CLAMPEADO dentro da banda: o engine
 * recusa elemento fora dos limites (largura da coluna × altura da banda).
 */
export function atualizarBoundsDoElemento(caminho: CaminhoDeElemento, bounds: Bounds) {
  return (template: ReportTemplate): ReportTemplate => {
    const larguraBanda = template.pageFormat.columnWidth;
    return comBanda(template, caminho.banda, (banda) => {
      const elemento = banda.elements[caminho.indice];
      if (!elemento) return banda;
      const elements = banda.elements.slice();
      elements[caminho.indice] = { ...elemento, bounds: clampNaBanda(bounds, banda, larguraBanda) };
      return { ...banda, elements };
    });
  };
}

/** Agrupa caminhos por banda (para comandos multi-elemento). */
function agruparPorBanda(caminhos: CaminhoDeElemento[]): Array<{ banda: CaminhoDeBanda; indices: number[] }> {
  const grupos = new Map<string, { banda: CaminhoDeBanda; indices: number[] }>();
  for (const c of caminhos) {
    const chave = chaveDaBanda(c.banda);
    const grupo = grupos.get(chave) ?? { banda: c.banda, indices: [] };
    grupo.indices.push(c.indice);
    grupos.set(chave, grupo);
  }
  return [...grupos.values()];
}

/** Nudge por teclado (2.6): desloca a seleção em pt, com clamp por banda. */
export function nudgeElementos(caminhos: CaminhoDeElemento[], dxPt: number, dyPt: number) {
  return (template: ReportTemplate): ReportTemplate => {
    let atual = template;
    for (const grupo of agruparPorBanda(caminhos)) {
      atual = comBanda(atual, grupo.banda, (banda) => {
        const elements = banda.elements.slice();
        for (const i of grupo.indices) {
          const el = elements[i];
          if (!el) continue;
          elements[i] = {
            ...el,
            bounds: clampNaBanda(
              { ...el.bounds, x: el.bounds.x + dxPt, y: el.bounds.y + dyPt },
              banda,
              atual.pageFormat.columnWidth,
            ),
          };
        }
        return { ...banda, elements };
      });
    }
    return atual;
  };
}

/** Delete (2.6): remove os elementos selecionados. */
export function removerElementos(caminhos: CaminhoDeElemento[]) {
  return (template: ReportTemplate): ReportTemplate => {
    let atual = template;
    for (const grupo of agruparPorBanda(caminhos)) {
      const indices = new Set(grupo.indices);
      atual = comBanda(atual, grupo.banda, (banda) => ({
        ...banda,
        elements: banda.elements.filter((_, i) => !indices.has(i)),
      }));
    }
    return atual;
  };
}

/**
 * Paste (2.6): insere cópias na banda de ORIGEM com deslocamento, e devolve a
 * nova seleção (os elementos colados, no fim = na frente da pintura).
 */
export function colarElementos(
  template: ReportTemplate,
  banda: CaminhoDeBanda,
  elementos: Element[],
  deslocamentoPt: number,
): { template: ReportTemplate; selecao: CaminhoDeElemento[] } {
  let selecao: CaminhoDeElemento[] = [];
  const novoTemplate = comBanda(template, banda, (b) => {
    const copias = elementos.map((el) => ({
      ...structuredClone(el),
      bounds: clampNaBanda(
        { ...el.bounds, x: el.bounds.x + deslocamentoPt, y: el.bounds.y + deslocamentoPt },
        b,
        template.pageFormat.columnWidth,
      ),
    }));
    selecao = copias.map((_, k) => ({ banda, indice: b.elements.length + k }));
    return { ...b, elements: [...b.elements, ...copias] };
  });
  return { template: novoTemplate, selecao };
}

// ---------------------------------------------------------------------------
// Comandos de multi-seleção (tarefa 2.5): alinhar, distribuir, z-order.
// Todos operam apenas quando a seleção está NUMA MESMA banda (coordenadas
// são relativas à banda — alinhar entre bandas não tem significado).

/** Banda comum a todos os caminhos, ou null. */
export function bandaComum(caminhos: CaminhoDeElemento[]): CaminhoDeBanda | null {
  const primeira = caminhos[0]?.banda;
  if (!primeira) return null;
  const chave = chaveDaBanda(primeira);
  return caminhos.every((c) => chaveDaBanda(c.banda) === chave) ? primeira : null;
}

export type Alinhamento = 'esquerda' | 'centroH' | 'direita' | 'topo' | 'centroV' | 'base';

/** Alinha a seleção (≥2, mesma banda) à caixa envolvente da própria seleção. */
export function alinharElementos(caminhos: CaminhoDeElemento[], alinhamento: Alinhamento) {
  return (template: ReportTemplate): ReportTemplate => {
    const banda = bandaComum(caminhos);
    if (!banda || caminhos.length < 2) return template;
    const indices = caminhos.map((c) => c.indice);

    return comBanda(template, banda, (b) => {
      const caixas = indices.map((i) => b.elements[i]?.bounds).filter((x): x is Bounds => x !== undefined);
      if (caixas.length < 2) return b;
      const minX = Math.min(...caixas.map((c) => c.x));
      const maxDir = Math.max(...caixas.map((c) => c.x + c.width));
      const minY = Math.min(...caixas.map((c) => c.y));
      const maxBase = Math.max(...caixas.map((c) => c.y + c.height));

      const elements = b.elements.slice();
      for (const i of indices) {
        const el = elements[i];
        if (!el) continue;
        const bo = el.bounds;
        let { x, y } = bo;
        switch (alinhamento) {
          case 'esquerda': x = minX; break;
          case 'direita': x = maxDir - bo.width; break;
          case 'centroH': x = Math.round((minX + maxDir) / 2 - bo.width / 2); break;
          case 'topo': y = minY; break;
          case 'base': y = maxBase - bo.height; break;
          case 'centroV': y = Math.round((minY + maxBase) / 2 - bo.height / 2); break;
        }
        elements[i] = { ...el, bounds: { ...bo, x, y } };
      }
      return { ...b, elements };
    });
  };
}

/** Distribui a seleção (≥3, mesma banda) com espaçamento igual entre os itens. */
export function distribuirElementos(caminhos: CaminhoDeElemento[], eixo: 'horizontal' | 'vertical') {
  return (template: ReportTemplate): ReportTemplate => {
    const banda = bandaComum(caminhos);
    if (!banda || caminhos.length < 3) return template;
    const indices = caminhos.map((c) => c.indice);

    return comBanda(template, banda, (b) => {
      const presentes = indices.filter((i) => b.elements[i] !== undefined);
      if (presentes.length < 3) return b;

      const pos = (bo: Bounds) => (eixo === 'horizontal' ? bo.x : bo.y);
      const tam = (bo: Bounds) => (eixo === 'horizontal' ? bo.width : bo.height);

      const ordenados = presentes
        .map((i) => ({ i, bounds: b.elements[i]!.bounds }))
        .sort((a, z) => pos(a.bounds) - pos(z.bounds));

      const inicio = pos(ordenados[0]!.bounds);
      const fim = Math.max(...ordenados.map((o) => pos(o.bounds) + tam(o.bounds)));
      const somaTamanhos = ordenados.reduce((s, o) => s + tam(o.bounds), 0);
      const vao = (fim - inicio - somaTamanhos) / (ordenados.length - 1);

      const elements = b.elements.slice();
      let cursor = inicio;
      for (const o of ordenados) {
        const el = elements[o.i]!;
        const bo = el.bounds;
        elements[o.i] = {
          ...el,
          bounds: eixo === 'horizontal' ? { ...bo, x: Math.round(cursor) } : { ...bo, y: Math.round(cursor) },
        };
        cursor += tam(bo) + vao;
      }
      return { ...b, elements };
    });
  };
}

/**
 * z-order (2.5): no JRXML a ordem de PINTURA é a ordem dos elementos na banda
 * — reordenar muda os índices, então a nova seleção é devolvida junto.
 */
export function aplicarZOrder(
  template: ReportTemplate,
  caminhos: CaminhoDeElemento[],
  direcao: 'frente' | 'tras',
): { template: ReportTemplate; selecao: CaminhoDeElemento[] } {
  const banda = bandaComum(caminhos);
  if (!banda || caminhos.length === 0) return { template, selecao: caminhos };

  const selecionados = new Set(caminhos.map((c) => c.indice));
  let novaSelecao: CaminhoDeElemento[] = caminhos;

  const novoTemplate = comBanda(template, banda, (b) => {
    const doGrupo: Element[] = [];
    const restantes: Element[] = [];
    b.elements.forEach((el, i) => (selecionados.has(i) ? doGrupo : restantes).push(el));

    const elements = direcao === 'frente' ? [...restantes, ...doGrupo] : [...doGrupo, ...restantes];
    const base = direcao === 'frente' ? restantes.length : 0;
    novaSelecao = doGrupo.map((_, k) => ({ banda, indice: base + k }));
    return { ...b, elements };
  });

  return { template: novoTemplate, selecao: novaSelecao };
}
