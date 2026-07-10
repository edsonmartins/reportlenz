/**
 * Canvas do designer (RFC-004 §2-§3, tarefa phase-2/2.1): réguas mm nos dois
 * eixos + folha rolável. As bandas (2.2) e elementos (2.3) entram como filhos
 * da PaginaCanvas.
 */
import { useEffect } from 'react';
import { useDocumentoStore } from '../store/documentoStore';
import { useCanvasStore } from '../store/canvasStore';
import { ESPESSURA_REGUA, Regua } from './Regua';
import { PaginaCanvas } from './PaginaCanvas';
import { BandaCanvas } from './BandaCanvas';
import { chaveDaBanda, faixasDeBandas } from './bandas';

const MARGEM_EM_TORNO_DA_FOLHA = 24;

/** Passos do nudge (RFC-004 §3: setas 1pt; Shift 10pt). */
const NUDGE_PT = 1;
const NUDGE_SHIFT_PT = 10;

/** Atalhos de teclado do canvas (2.6): nudge, delete, copy/paste. */
function useTecladoDoCanvas() {
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      const alvo = e.target as HTMLElement | null;
      if (alvo && (['INPUT', 'TEXTAREA', 'SELECT'].includes(alvo.tagName) || alvo.isContentEditable)) {
        return; // digitação em campos não mexe no canvas
      }
      const s = useDocumentoStore.getState();
      if (!s.template) return;

      const passo = e.shiftKey ? NUDGE_SHIFT_PT : NUDGE_PT;
      const temSelecao = s.selecao.length > 0;

      switch (e.key) {
        case 'ArrowLeft':
          if (temSelecao) { e.preventDefault(); s.moverSelecao(-passo, 0); }
          return;
        case 'ArrowRight':
          if (temSelecao) { e.preventDefault(); s.moverSelecao(passo, 0); }
          return;
        case 'ArrowUp':
          if (temSelecao) { e.preventDefault(); s.moverSelecao(0, -passo); }
          return;
        case 'ArrowDown':
          if (temSelecao) { e.preventDefault(); s.moverSelecao(0, passo); }
          return;
        case 'Delete':
        case 'Backspace':
          if (temSelecao) { e.preventDefault(); s.removerSelecao(); }
          return;
        default:
          if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && temSelecao) {
            s.copiarSelecao();
          } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
            e.preventDefault();
            s.colarClipboard();
          } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            if (e.shiftKey) s.refazer();
            else s.desfazer();
          } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
            e.preventDefault();
            s.refazer();
          }
      }
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, []);
}

export function Canvas() {
  useTecladoDoCanvas();
  const template = useDocumentoStore((s) => s.template);
  const zoom = useCanvasStore((s) => s.zoom);
  const mostrarGrid = useCanvasStore((s) => s.mostrarGrid);
  const passoGridMm = useCanvasStore((s) => s.passoGridMm);

  if (!template) return null;
  const pf = template.pageFormat;

  return (
    <div
      data-testid="canvas"
      style={{
        display: 'grid',
        gridTemplateColumns: `${ESPESSURA_REGUA}px 1fr`,
        gridTemplateRows: `${ESPESSURA_REGUA}px 1fr`,
        height: '100%',
        minHeight: 480,
        overflow: 'auto',
        background: 'var(--mantine-color-gray-2)',
      }}
    >
      {/* canto morto */}
      <div style={{ background: 'var(--mantine-color-gray-1)' }} />
      <div style={{ paddingLeft: MARGEM_EM_TORNO_DA_FOLHA }}>
        <Regua orientacao="horizontal" comprimentoPt={pf.pageWidth} zoom={zoom} />
      </div>
      <div style={{ paddingTop: MARGEM_EM_TORNO_DA_FOLHA }}>
        <Regua orientacao="vertical" comprimentoPt={pf.pageHeight} zoom={zoom} />
      </div>
      <div style={{ padding: MARGEM_EM_TORNO_DA_FOLHA }}>
        <PaginaCanvas pageFormat={pf} zoom={zoom} mostrarGrid={mostrarGrid} passoGridMm={passoGridMm}>
          {faixasDeBandas(template).map((faixa) => (
            <BandaCanvas key={chaveDaBanda(faixa.caminho)} faixa={faixa} pageFormat={pf} zoom={zoom} />
          ))}
        </PaginaCanvas>
      </div>
    </div>
  );
}
