/**
 * Snapping com guias de alinhamento (RFC-004 §3 — prioridade alta do roadmap
 * do Web Studio; tarefa phase-2/2.4). Módulo PURO.
 *
 * Alvos: bordas e centros dos OUTROS elementos da banda + bordas da banda.
 * O snap de elemento tem prioridade sobre o snap de grid (grid só entra
 * quando nenhum alvo de elemento está na tolerância, e não desenha guia).
 */
import type { Band, Bounds } from '@reportlenz/jrxml-core';

export interface AlvosDeSnap {
  xs: number[];
  ys: number[];
}

/** Alvos de snap da banda, ignorando o(s) elemento(s) em arraste. */
export function alvosDeSnap(banda: Band, ignorarIndices: ReadonlySet<number>, larguraBandaPt: number): AlvosDeSnap {
  const xs = new Set<number>([0, larguraBandaPt]);
  const ys = new Set<number>([0, banda.height]);
  banda.elements.forEach((el, i) => {
    if (ignorarIndices.has(i)) return;
    const b = el.bounds;
    xs.add(b.x);
    xs.add(b.x + b.width / 2);
    xs.add(b.x + b.width);
    ys.add(b.y);
    ys.add(b.y + b.height / 2);
    ys.add(b.y + b.height);
  });
  return { xs: [...xs].sort((a, b) => a - b), ys: [...ys].sort((a, b) => a - b) };
}

interface Ajuste {
  delta: number;
  alvo: number;
}

function melhorAjuste(posicoes: number[], alvos: number[], toleranciaPt: number): Ajuste | null {
  let melhor: Ajuste | null = null;
  for (const p of posicoes) {
    for (const a of alvos) {
      const delta = a - p;
      if (Math.abs(delta) <= toleranciaPt && (melhor === null || Math.abs(delta) < Math.abs(melhor.delta))) {
        melhor = { delta, alvo: a };
      }
    }
  }
  return melhor;
}

export interface ResultadoDeSnap {
  bounds: Bounds;
  /** Posição (pt, espaço da banda) da guia ativa — null quando não houve snap de elemento. */
  guiaX: number | null;
  guiaY: number | null;
}

/**
 * Ajusta os bounds em arraste: testa esquerda/centro/direita contra os alvos
 * X e topo/meio/base contra os alvos Y; sem alvo de elemento, cai para o grid
 * (borda esquerda/topo no múltiplo mais próximo do passo).
 */
export function aplicarSnap(
  bounds: Bounds,
  alvos: AlvosDeSnap,
  toleranciaPt: number,
  gridPassoPt?: number,
): ResultadoDeSnap {
  const posicoesX = [bounds.x, bounds.x + bounds.width / 2, bounds.x + bounds.width];
  const posicoesY = [bounds.y, bounds.y + bounds.height / 2, bounds.y + bounds.height];
  const ajusteX = melhorAjuste(posicoesX, alvos.xs, toleranciaPt);
  const ajusteY = melhorAjuste(posicoesY, alvos.ys, toleranciaPt);

  let x = bounds.x;
  let y = bounds.y;
  let guiaX: number | null = null;
  let guiaY: number | null = null;

  if (ajusteX) {
    x += ajusteX.delta;
    guiaX = ajusteX.alvo;
  } else if (gridPassoPt && gridPassoPt > 0) {
    x = Math.round(bounds.x / gridPassoPt) * gridPassoPt;
  }

  if (ajusteY) {
    y += ajusteY.delta;
    guiaY = ajusteY.alvo;
  } else if (gridPassoPt && gridPassoPt > 0) {
    y = Math.round(bounds.y / gridPassoPt) * gridPassoPt;
  }

  return { bounds: { ...bounds, x, y }, guiaX, guiaY };
}
