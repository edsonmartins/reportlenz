/**
 * Mutações do documento (tarefa phase-2/2.2 em diante): funções puras
 * `ReportTemplate → ReportTemplate` para usar com `mutarTemplate` — cada uma
 * passa automaticamente pela validação contínua (1.2).
 */
import type {
  Band,
  Bounds,
  ColunaDeTabela,
  ConditionalStyle,
  DataContract,
  Element,
  FieldDecl,
  PageFormat,
  ReportTemplate,
  Style,
  StyleProps,
  TableColumn,
  TableElement,
} from '@reportlenz/jrxml-core';
import { eGrupoDeColunas } from '@reportlenz/jrxml-core';
import type { BlocoReutilizavel } from '../blocos/biblioteca';
import { mesclarMiniContrato, reescreverElemento } from '../blocos/mesclarContrato';
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

/**
 * Mutação do contrato de dados (DataContractPanel, bloco 4). O contrato é a
 * ÚNICA fonte de dados do template (ADR-003) — não existe, por construção,
 * mutação que anexe query/conexão.
 */
export function comContrato(template: ReportTemplate, atualizar: (contrato: DataContract) => DataContract): ReportTemplate {
  return { ...template, dataContract: atualizar(template.dataContract) };
}

/**
 * Sobrescrita local de estilo (painel de propriedades, 3.2): `undefined`
 * REMOVE a sobrescrita (volta a herdar); style vazio some do elemento.
 */
export function definirEstiloDoElemento<K extends keyof StyleProps>(
  caminho: CaminhoDeElemento,
  prop: K,
  valor: StyleProps[K] | undefined,
) {
  return (template: ReportTemplate): ReportTemplate =>
    comElemento(template, caminho, (el) => {
      const style: StyleProps = { ...el.style };
      if (valor === undefined) {
        delete style[prop];
      } else {
        style[prop] = valor;
      }
      if (Object.keys(style).length === 0) {
        const copia = { ...el };
        delete copia.style;
        return copia;
      }
      return { ...el, style };
    });
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

// ---------------------------------------------------------------------------
// Página e colunas (Fase 3, bloco 7 — grade de etiquetas A4, ADR-011)

/** Atualiza o PageFormat; `printOrder: undefined` remove (Vertical é o default). */
export function atualizarPagina(patch: Partial<PageFormat>) {
  return (template: ReportTemplate): ReportTemplate => {
    const pageFormat: PageFormat = { ...template.pageFormat, ...patch };
    if (pageFormat.printOrder === undefined || pageFormat.printOrder === 'Vertical') {
      delete pageFormat.printOrder;
    }
    return { ...template, pageFormat };
  };
}

// ---------------------------------------------------------------------------
// Biblioteca de blocos (Fase 3, bloco 8)

/**
 * Insere um bloco reutilizável (8.1): mescla o mini-contrato ao contrato do
 * template (8.2 — conflitos renomeiam e as expressões do bloco são
 * reescritas), garante a banda de destino (cria se não existir; estica até a
 * altura mínima, nunca encolhe) e cola os elementos, que nascem selecionados.
 */
export function inserirBloco(
  template: ReportTemplate,
  bloco: BlocoReutilizavel,
): { template: ReportTemplate; selecao: CaminhoDeElemento[]; avisos: string[] } {
  const { contrato, renomeios, avisos } = mesclarMiniContrato(template.dataContract, bloco.miniContrato);
  let t: ReportTemplate = {
    ...template,
    dataContract: contrato,
    // Proveniência versionada (phase-4/6.1 — RFC-006 §5): o JRXML publicado
    // registra qual bloco/versão o compôs (property serializada, auditável).
    properties: { ...template.properties, [`reportlenz.bloco.${bloco.id}`]: String(bloco.versao) },
  };

  const caminho: CaminhoDeBanda =
    bloco.destino === 'detail' ? { tipo: 'detail', indice: 0 } : { tipo: 'secao', secao: bloco.destino };
  if (bloco.destino !== 'detail' && !t.bands[bloco.destino]) {
    t = {
      ...t,
      bands: { ...t.bands, [bloco.destino]: { height: bloco.alturaMinimaPt, splitType: 'Stretch', elements: [] } },
    };
  }
  t = comBanda(t, caminho, (banda) => ({ ...banda, height: Math.max(banda.height, bloco.alturaMinimaPt) }));

  const elementos = bloco.elementos.map((el) => reescreverElemento(el, renomeios));
  const resultado = colarElementos(t, caminho, elementos, 0);
  return { ...resultado, avisos };
}

// ---------------------------------------------------------------------------
// Grupos com subtotais (Fase 3, bloco 5)

const ALTURA_BANDA_DE_GRUPO = 20;

function comGrupos(template: ReportTemplate, atualizar: (grupos: ReportTemplate['bands']['groups']) => ReportTemplate['bands']['groups']): ReportTemplate {
  return { ...template, bands: { ...template.bands, groups: atualizar(template.bands.groups) } };
}

/** 5.1: novo grupo com quebra por expressão (header e footer prontos). */
export function adicionarGrupo(nome: string, expressao: string) {
  return (template: ReportTemplate): ReportTemplate => {
    const limpo = nome.trim();
    if (!limpo || template.bands.groups.some((g) => g.name === limpo)) return template;
    return comGrupos(template, (grupos) => [
      ...grupos,
      {
        name: limpo,
        expression: expressao,
        header: { height: ALTURA_BANDA_DE_GRUPO, splitType: 'Stretch', elements: [] },
        footer: { height: ALTURA_BANDA_DE_GRUPO, splitType: 'Stretch', elements: [] },
      },
    ]);
  };
}

/** Remove o grupo; resetGroup órfão em variáveis vira problema no checker. */
export function removerGrupo(nome: string) {
  return (template: ReportTemplate): ReportTemplate =>
    comGrupos(template, (grupos) => grupos.filter((g) => g.name !== nome));
}

export function atualizarGrupo(nome: string, patch: Partial<Pick<ReportTemplate['bands']['groups'][number], 'expression' | 'startNewPage'>>) {
  return (template: ReportTemplate): ReportTemplate =>
    comGrupos(template, (grupos) =>
      grupos.map((g) => {
        if (g.name !== nome) return g;
        const novo = { ...g, ...patch };
        if (novo.startNewPage === undefined) delete novo.startNewPage;
        return novo;
      }),
    );
}

/** Liga/desliga as bandas header/footer do grupo. */
export function alternarBandaDoGrupo(nome: string, parte: 'header' | 'footer') {
  return (template: ReportTemplate): ReportTemplate =>
    comGrupos(template, (grupos) =>
      grupos.map((g) => {
        if (g.name !== nome) return g;
        const novo = { ...g };
        if (novo[parte]) {
          delete novo[parte];
        } else {
          novo[parte] = { height: ALTURA_BANDA_DE_GRUPO, splitType: 'Stretch', elements: [] };
        }
        return novo;
      }),
    );
}

/**
 * 5.1 (subtotal): cria a variável `Sum` com reset no grupo e o textField no
 * rodapé do grupo (criando o rodapé se não existir) — subtotais em um passo.
 */
export function adicionarSubtotalAoGrupo(nomeGrupo: string, campo: FieldDecl) {
  return (template: ReportTemplate): ReportTemplate => {
    const grupo = template.bands.groups.find((g) => g.name === nomeGrupo);
    if (!grupo || (campo.type !== 'decimal' && campo.type !== 'integer')) return template;

    const nomeVariavel = `soma_${campo.name}_${nomeGrupo}`.replaceAll('.', '_');
    if (template.dataContract.variables.some((v) => v.name === nomeVariavel)) return template;

    const comVariavel: ReportTemplate = {
      ...template,
      dataContract: {
        ...template.dataContract,
        variables: [
          ...template.dataContract.variables,
          {
            name: nomeVariavel,
            type: campo.type,
            calculation: 'Sum',
            expression: `$F{${campo.name}}`,
            resetType: 'Group',
            resetGroup: nomeGrupo,
          },
        ],
      },
    };

    return comGrupos(comVariavel, (grupos) =>
      grupos.map((g) => {
        if (g.name !== nomeGrupo) return g;
        const footer: Band = g.footer ?? { height: ALTURA_BANDA_DE_GRUPO, splitType: 'Stretch', elements: [] };
        return {
          ...g,
          footer: {
            ...footer,
            elements: [
              ...footer.elements,
              {
                kind: 'textField',
                bounds: { x: 0, y: 2, width: 160, height: 14 },
                expression: `$V{${nomeVariavel}}`,
                pattern: campo.type === 'decimal' ? '#,##0.00' : '#,##0',
                style: { bold: true, hAlign: 'Right' },
              },
            ],
          },
        };
      }),
    );
  };
}

// ---------------------------------------------------------------------------
// Gerenciador de estilos (Fase 3, bloco 4)

function comEstilos(template: ReportTemplate, atualizar: (styles: Style[]) => Style[]): ReportTemplate {
  return { ...template, styles: atualizar(template.styles) };
}

export function adicionarEstilo(nome: string) {
  return (template: ReportTemplate): ReportTemplate => {
    const limpo = nome.trim();
    if (!limpo || template.styles.some((s) => s.name === limpo)) return template;
    return comEstilos(template, (styles) => [...styles, { name: limpo }]);
  };
}

/** Remove o estilo; referências órfãs (styleRef) viram problema no checker. */
export function removerEstilo(nome: string) {
  return (template: ReportTemplate): ReportTemplate =>
    comEstilos(template, (styles) => styles.filter((s) => s.name !== nome));
}

/** Atualiza o estilo; `isDefault: true` é EXCLUSIVO (limpa os demais). */
export function atualizarEstilo(nome: string, patch: Partial<Style>) {
  return (template: ReportTemplate): ReportTemplate =>
    comEstilos(template, (styles) =>
      styles.map((s) => {
        if (s.name !== nome) {
          return patch.isDefault === true && s.isDefault ? limparIsDefault(s) : s;
        }
        const novo: Style = { ...s, ...patch };
        // Campos zerados saem do objeto (herança limpa no serializer).
        for (const chave of Object.keys(patch) as Array<keyof Style>) {
          if (novo[chave] === undefined) delete novo[chave];
        }
        return novo;
      }),
    );
}

function limparIsDefault(s: Style): Style {
  const copia = { ...s };
  delete copia.isDefault;
  return copia;
}

/** Condições do estilo (4.2): destacar linhas quando a expressão for verdadeira. */
export function adicionarCondicaoDeEstilo(nome: string) {
  return (template: ReportTemplate): ReportTemplate =>
    comEstilos(template, (styles) =>
      styles.map((s) =>
        s.name === nome
          ? {
              ...s,
              conditionalStyles: [
                ...(s.conditionalStyles ?? []),
                { conditionExpression: '$V{REPORT_COUNT} % 2 == 0', style: { mode: 'Opaque', backcolor: '#F0F0F0' } },
              ],
            }
          : s,
      ),
    );
}

export function atualizarCondicaoDeEstilo(nome: string, indice: number, patch: Partial<ConditionalStyle>) {
  return (template: ReportTemplate): ReportTemplate =>
    comEstilos(template, (styles) =>
      styles.map((s) => {
        if (s.name !== nome || !s.conditionalStyles?.[indice]) return s;
        const conditionalStyles = s.conditionalStyles.slice();
        conditionalStyles[indice] = { ...conditionalStyles[indice]!, ...patch };
        return { ...s, conditionalStyles };
      }),
    );
}

export function removerCondicaoDeEstilo(nome: string, indice: number) {
  return (template: ReportTemplate): ReportTemplate =>
    comEstilos(template, (styles) =>
      styles.map((s) => {
        if (s.name !== nome || !s.conditionalStyles) return s;
        const conditionalStyles = s.conditionalStyles.filter((_, i) => i !== indice);
        if (conditionalStyles.length === 0) {
          const copia = { ...s };
          delete copia.conditionalStyles;
          return copia;
        }
        return { ...s, conditionalStyles };
      }),
    );
}

// ---------------------------------------------------------------------------
// Editor de tabela (Fase 3, bloco 2)

function comTabela(template: ReportTemplate, caminho: CaminhoDeElemento, atualizar: (t: TableElement) => TableElement): ReportTemplate {
  return comElemento(template, caminho, (el) => (el.kind === 'table' ? atualizar(el) : el));
}

const ALTURA_HEADER = 16;
const ALTURA_DETAIL = 14;
const LARGURA_NOVA_COLUNA = 100;

function larguraDe(col: ColunaDeTabela): number {
  return eGrupoDeColunas(col) ? col.columns.reduce((s, c) => s + larguraDe(c), 0) : col.width;
}

/** Recalcula larguras de grupos (soma das filhas) — invariante do JR. */
function normalizarLarguras(colunas: ColunaDeTabela[]): ColunaDeTabela[] {
  return colunas.map((c) =>
    eGrupoDeColunas(c) ? { ...c, columns: normalizarLarguras(c.columns), width: larguraDe(c) } : c,
  );
}

/** 2.4: nova coluna LIGADA a um campo do item da coleção (header + $F{campo}). */
export function adicionarColunaDeTabela(caminho: CaminhoDeElemento, campo: FieldDecl) {
  return (template: ReportTemplate): ReportTemplate =>
    comTabela(template, caminho, (tabela) => {
      const pattern = campo.type === 'decimal' ? '#,##0.00' : campo.type === 'date' ? 'dd/MM/yyyy' : undefined;
      const nova: TableColumn = {
        width: LARGURA_NOVA_COLUNA,
        header: {
          height: ALTURA_HEADER,
          elements: [
            { kind: 'staticText', bounds: { x: 0, y: 0, width: LARGURA_NOVA_COLUNA, height: ALTURA_HEADER }, style: { bold: true }, text: campo.name },
          ],
        },
        detail: {
          height: ALTURA_DETAIL,
          elements: [
            {
              kind: 'textField',
              bounds: { x: 0, y: 0, width: LARGURA_NOVA_COLUNA, height: ALTURA_DETAIL },
              expression: `$F{${campo.name}}`,
              ...(pattern ? { pattern } : {}),
            },
          ],
        },
      };
      return { ...tabela, columns: [...tabela.columns, nova] };
    });
}

/** 2.2: remove a coluna/grupo raiz no índice. */
export function removerColunaDeTabela(caminho: CaminhoDeElemento, indice: number) {
  return (template: ReportTemplate): ReportTemplate =>
    comTabela(template, caminho, (tabela) => ({
      ...tabela,
      columns: tabela.columns.filter((_, i) => i !== indice),
    }));
}

/** 2.2: reordena colunas raiz (grupos movem como unidade). */
export function moverColunaDeTabela(caminho: CaminhoDeElemento, de: number, para: number) {
  return (template: ReportTemplate): ReportTemplate =>
    comTabela(template, caminho, (tabela) => {
      if (de < 0 || de >= tabela.columns.length || para < 0 || para >= tabela.columns.length) return tabela;
      const columns = tabela.columns.slice();
      const [movida] = columns.splice(de, 1);
      columns.splice(para, 0, movida!);
      return { ...tabela, columns };
    });
}

/** Largura de coluna folha (grupos são soma automática). */
export function definirLarguraDaColuna(caminho: CaminhoDeElemento, indice: number, largura: number) {
  return (template: ReportTemplate): ReportTemplate =>
    comTabela(template, caminho, (tabela) => {
      const col = tabela.columns[indice];
      if (!col || eGrupoDeColunas(col)) return tabela;
      const columns = tabela.columns.slice();
      columns[indice] = { ...col, width: Math.max(10, Math.round(largura)) };
      return { ...tabela, columns: normalizarLarguras(columns) };
    });
}

/** 2.3: liga/desliga as seções header/footer de uma coluna folha. */
export function alternarSecaoDaColuna(caminho: CaminhoDeElemento, indice: number, secao: 'header' | 'footer') {
  return (template: ReportTemplate): ReportTemplate =>
    comTabela(template, caminho, (tabela) => {
      const col = tabela.columns[indice];
      if (!col || eGrupoDeColunas(col)) return tabela;
      const columns = tabela.columns.slice();
      const nova: TableColumn = { ...col };
      if (nova[secao]) {
        delete nova[secao];
      } else {
        nova[secao] = { height: ALTURA_HEADER, elements: [] };
      }
      columns[indice] = nova;
      return { ...tabela, columns };
    });
}

/** 2.3 (merge): agrupa a coluna raiz `indice` com a seguinte sob um cabeçalho comum. */
export function agruparColunas(caminho: CaminhoDeElemento, indice: number, titulo = 'Grupo') {
  return (template: ReportTemplate): ReportTemplate =>
    comTabela(template, caminho, (tabela) => {
      const a = tabela.columns[indice];
      const b = tabela.columns[indice + 1];
      if (!a || !b) return tabela;
      const width = larguraDe(a) + larguraDe(b);
      const grupo: ColunaDeTabela = {
        width,
        header: {
          height: ALTURA_HEADER,
          elements: [
            { kind: 'staticText', bounds: { x: 0, y: 0, width, height: ALTURA_HEADER }, style: { bold: true, hAlign: 'Center' }, text: titulo },
          ],
        },
        columns: [a, b],
      };
      const columns = tabela.columns.slice();
      columns.splice(indice, 2, grupo);
      return { ...tabela, columns };
    });
}

/** 2.3 (split): desfaz o grupo raiz `indice`, promovendo as filhas. */
export function desagruparColunas(caminho: CaminhoDeElemento, indice: number) {
  return (template: ReportTemplate): ReportTemplate =>
    comTabela(template, caminho, (tabela) => {
      const grupo = tabela.columns[indice];
      if (!grupo || !eGrupoDeColunas(grupo)) return tabela;
      const columns = tabela.columns.slice();
      columns.splice(indice, 1, ...grupo.columns);
      return { ...tabela, columns };
    });
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
