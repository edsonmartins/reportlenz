/**
 * Faixa de banda no canvas (tarefa phase-2/2.2): área da banda com rótulo e
 * handle de resize de altura na borda inferior. O arraste COMMITA a mutação a
 * cada movimento (validação contínua da 1.2 acompanha ao vivo; o histórico do
 * undo/redo da 2.7 fará a coalescência por gesto).
 */
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useRef } from 'react';
import { useCanvasStore } from '../store/canvasStore';
import { useDocumentoStore } from '../store/documentoStore';
import { redimensionarBanda } from '../store/mutacoes';
import type { FaixaDeBanda } from './bandas';
import { chaveDaBanda } from './bandas';
import { ElementoCanvas } from './ElementoCanvas';
import { areaUtil, ptParaPx, pxParaPt } from './geometria';
import type { PageFormat } from '@reportlenz/jrxml-core';

const ALTURA_DO_HANDLE = 6;

interface BandaCanvasProps {
  faixa: FaixaDeBanda;
  pageFormat: PageFormat;
  zoom: number;
}

export function BandaCanvas({ faixa, pageFormat, zoom }: BandaCanvasProps) {
  const mutarTemplate = useDocumentoStore((s) => s.mutarTemplate);
  const limparSelecao = useDocumentoStore((s) => s.limparSelecao);
  const util = areaUtil(pageFormat);
  const arrasto = useRef<{ yInicialPx: number; alturaInicialPt: number } | null>(null);

  const aoIniciarArrasto = (e: ReactPointerEvent<HTMLDivElement>) => {
    useDocumentoStore.getState().iniciarGesto(); // 2.7: resize de banda = 1 undo
    arrasto.current = { yInicialPx: e.clientY, alturaInicialPt: faixa.alturaPt };
    // jsdom não implementa pointer capture — proteger para os testes.
    if (e.currentTarget.setPointerCapture && e.currentTarget.hasPointerCapture !== undefined) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ambiente sem pointer capture */
      }
    }
  };

  const aoMoverArrasto = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!arrasto.current) return;
    const deltaPt = pxParaPt(e.clientY - arrasto.current.yInicialPx, zoom);
    mutarTemplate(redimensionarBanda(faixa.caminho, arrasto.current.alturaInicialPt + deltaPt));
  };

  const aoTerminarArrasto = () => {
    arrasto.current = null;
    useDocumentoStore.getState().encerrarGesto();
  };

  return (
    <div
      data-testid={`banda-${chaveDaBanda(faixa.caminho)}`}
      onPointerDown={(e) => {
        // Clique em área vazia da banda limpa a seleção (2.3).
        if (e.target === e.currentTarget) limparSelecao();
      }}
      style={{
        position: 'absolute',
        left: ptParaPx(util.x, zoom),
        top: ptParaPx(faixa.yPt, zoom),
        width: ptParaPx(util.width, zoom),
        height: ptParaPx(faixa.alturaPt, zoom),
        borderBottom: '1px solid var(--mantine-color-gray-4)',
        boxSizing: 'border-box',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 1,
          left: 2,
          fontSize: 9,
          lineHeight: 1,
          padding: '1px 4px',
          borderRadius: 2,
          background: 'var(--mantine-color-gray-1)',
          color: 'var(--mantine-color-gray-7)',
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      >
        {faixa.rotulo} · {Math.round(faixa.alturaPt)}pt
      </span>

      {faixa.banda.elements.map((elemento, indice) => (
        <ElementoCanvas
          key={indice}
          caminho={{ banda: faixa.caminho, indice }}
          elemento={elemento}
          zoom={zoom}
        />
      ))}

      <GuiasDeSnapDaBanda chave={chaveDaBanda(faixa.caminho)} zoom={zoom} />

      <div
        data-testid={`resize-${chaveDaBanda(faixa.caminho)}`}
        role="separator"
        aria-label={`redimensionar ${faixa.rotulo}`}
        onPointerDown={aoIniciarArrasto}
        onPointerMove={aoMoverArrasto}
        onPointerUp={aoTerminarArrasto}
        onPointerCancel={aoTerminarArrasto}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: -ALTURA_DO_HANDLE / 2,
          height: ALTURA_DO_HANDLE,
          cursor: 'ns-resize',
        }}
      />
    </div>
  );
}

/** Linhas de guia do snap ativo (2.4) — desenhadas por cima dos elementos. */
function GuiasDeSnapDaBanda({ chave, zoom }: { chave: string; zoom: number }) {
  const guias = useCanvasStore((s) => s.guiasDeSnap);
  if (!guias || guias.banda !== chave) return null;
  return (
    <>
      {guias.x !== null && (
        <div
          data-testid="guia-snap-x"
          style={{
            position: 'absolute',
            left: ptParaPx(guias.x, zoom),
            top: 0,
            bottom: 0,
            width: 1,
            background: 'var(--mantine-color-pink-6)',
            pointerEvents: 'none',
          }}
        />
      )}
      {guias.y !== null && (
        <div
          data-testid="guia-snap-y"
          style={{
            position: 'absolute',
            top: ptParaPx(guias.y, zoom),
            left: 0,
            right: 0,
            height: 1,
            background: 'var(--mantine-color-pink-6)',
            pointerEvents: 'none',
          }}
        />
      )}
    </>
  );
}
