/**
 * Elemento no canvas (RFC-004 §3, tarefa phase-2/2.3): aproximação visual por
 * kind + seleção por clique (Shift = aditiva) + mover pelo corpo + resize por
 * 8 handles. Toda mudança de bounds passa por atualizarBoundsDoElemento
 * (clamp na banda + validação contínua).
 *
 * O desenho aqui é APROXIMAÇÃO (I-8): a verdade é o render Jasper (bloco 5).
 */
import type { Bounds, Element } from '@reportlenz/jrxml-core';
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { useRef } from 'react';
import type { CaminhoDeElemento } from '../store/documentoStore';
import { obterBanda, useDocumentoStore } from '../store/documentoStore';
import { atualizarBoundsDoElemento } from '../store/mutacoes';
import { chaveDoCaminho } from '../store/documentoStore';
import { useCanvasStore } from '../store/canvasStore';
import { chaveDaBanda } from './bandas';
import { mmParaPt, ptParaPx, pxParaPt } from './geometria';
import { alvosDeSnap, aplicarSnap } from './snap';

/** Tolerância de snap em px de tela (convertida para pt sob o zoom). */
const TOLERANCIA_SNAP_PX = 4;

type Direcao = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
type ModoDeArrasto = 'mover' | Direcao;

const DIRECOES: Direcao[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

const CURSOR: Record<Direcao, string> = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
};

function aplicarArrasto(modo: ModoDeArrasto, b: Bounds, dxPt: number, dyPt: number): Bounds {
  switch (modo) {
    case 'mover':
      return { ...b, x: b.x + dxPt, y: b.y + dyPt };
    case 'e':
      return { ...b, width: b.width + dxPt };
    case 'w':
      return { ...b, x: b.x + dxPt, width: b.width - dxPt };
    case 's':
      return { ...b, height: b.height + dyPt };
    case 'n':
      return { ...b, y: b.y + dyPt, height: b.height - dyPt };
    case 'se':
      return { ...b, width: b.width + dxPt, height: b.height + dyPt };
    case 'ne':
      return { ...b, y: b.y + dyPt, width: b.width + dxPt, height: b.height - dyPt };
    case 'sw':
      return { ...b, x: b.x + dxPt, width: b.width - dxPt, height: b.height + dyPt };
    case 'nw':
      return { ...b, x: b.x + dxPt, y: b.y + dyPt, width: b.width - dxPt, height: b.height - dyPt };
  }
}

/** Aproximação visual do conteúdo, por kind. */
function conteudo(el: Element, zoom: number): ReactNode {
  const fonte = (el.kind === 'staticText' || el.kind === 'textField' ? el.style?.fontSize : undefined) ?? 10;
  const base: CSSProperties = {
    fontSize: fonte * zoom,
    lineHeight: 1.15,
    overflow: 'hidden',
    whiteSpace: 'pre-wrap',
    fontWeight: el.kind !== 'line' && 'style' in el && el.style?.bold ? 700 : 400,
    textAlign: ('style' in el ? el.style?.hAlign : undefined)?.toLowerCase() as CSSProperties['textAlign'],
  };
  switch (el.kind) {
    case 'staticText':
      return <div style={base}>{el.text}</div>;
    case 'textField':
      return <div style={{ ...base, color: 'var(--mantine-color-blue-7)', fontStyle: 'italic' }}>{el.expression}</div>;
    case 'image':
      return <Placeholder rotulo={`imagem: ${el.expression}`} zoom={zoom} />;
    case 'barcode':
      return <Placeholder rotulo={`barcode ${el.barcodeType}`} zoom={zoom} />;
    case 'table':
      return <Placeholder rotulo={`tabela · $F{${el.datasetField}} · ${el.columns.length} col`} zoom={zoom} />;
    case 'subreport':
      return <Placeholder rotulo={`subreport: ${el.templateExpression}`} zoom={zoom} />;
    case 'frame':
      return <Placeholder rotulo={`frame · ${el.elements.length} elemento(s)`} zoom={zoom} />;
    case 'line':
    case 'rectangle':
    case 'ellipse':
      return null;
  }
}

function Placeholder({ rotulo, zoom }: { rotulo: string; zoom: number }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 8 * zoom,
        color: 'var(--mantine-color-gray-6)',
        background: 'var(--mantine-color-gray-0)',
        border: '1px dashed var(--mantine-color-gray-4)',
        overflow: 'hidden',
      }}
    >
      {rotulo}
    </div>
  );
}

function molduraDoKind(el: Element): CSSProperties {
  switch (el.kind) {
    case 'line':
      return { borderTop: `${Math.max(1, el.pen?.lineWidth ?? 1)}px solid ${el.pen?.lineColor ?? '#000'}` };
    case 'rectangle':
      return {
        border: `${Math.max(1, el.pen?.lineWidth ?? 1)}px solid ${el.pen?.lineColor ?? '#000'}`,
        borderRadius: el.radius ?? 0,
      };
    case 'ellipse':
      return { border: `${Math.max(1, el.pen?.lineWidth ?? 1)}px solid ${el.pen?.lineColor ?? '#000'}`, borderRadius: '50%' };
    default:
      return {};
  }
}

interface ElementoCanvasProps {
  caminho: CaminhoDeElemento;
  elemento: Element;
  zoom: number;
}

export function ElementoCanvas({ caminho, elemento, zoom }: ElementoCanvasProps) {
  const selecionar = useDocumentoStore((s) => s.selecionar);
  const mutarTemplate = useDocumentoStore((s) => s.mutarTemplate);
  const selecionado = useDocumentoStore((s) => s.selecao.some((c) => chaveDoCaminho(c) === chaveDoCaminho(caminho)));

  const arrasto = useRef<{ modo: ModoDeArrasto; x0: number; y0: number; bounds0: Bounds } | null>(null);

  const iniciar = (modo: ModoDeArrasto) => (e: ReactPointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (modo === 'mover') {
      selecionar(caminho, e.shiftKey);
    }
    useDocumentoStore.getState().iniciarGesto(); // 2.7: o drag inteiro = 1 undo
    arrasto.current = { modo, x0: e.clientX, y0: e.clientY, bounds0: elemento.bounds };
    if (e.currentTarget.setPointerCapture) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* jsdom sem pointer capture */
      }
    }
  };

  const mover = (e: ReactPointerEvent<HTMLDivElement>) => {
    const a = arrasto.current;
    if (!a) return;
    const dxPt = pxParaPt(e.clientX - a.x0, zoom);
    const dyPt = pxParaPt(e.clientY - a.y0, zoom);
    let candidato = aplicarArrasto(a.modo, a.bounds0, dxPt, dyPt);

    // Snapping (2.4): só no MOVER; Alt ignora pontualmente.
    const { snapAtivo, mostrarGrid, passoGridMm, definirGuiasDeSnap } = useCanvasStore.getState();
    if (a.modo === 'mover' && snapAtivo && !e.altKey) {
      const template = useDocumentoStore.getState().template;
      const banda = template ? obterBanda(template, caminho.banda) : undefined;
      if (template && banda) {
        const alvos = alvosDeSnap(banda, new Set([caminho.indice]), template.pageFormat.columnWidth);
        const resultado = aplicarSnap(
          candidato,
          alvos,
          pxParaPt(TOLERANCIA_SNAP_PX, zoom),
          mostrarGrid ? mmParaPt(passoGridMm) : undefined,
        );
        candidato = resultado.bounds;
        definirGuiasDeSnap({ banda: chaveDaBanda(caminho.banda), x: resultado.guiaX, y: resultado.guiaY });
      }
    } else if (a.modo === 'mover') {
      definirGuiasDeSnap(null);
    }

    mutarTemplate(atualizarBoundsDoElemento(caminho, candidato));
  };

  const terminar = () => {
    arrasto.current = null;
    useCanvasStore.getState().definirGuiasDeSnap(null);
    useDocumentoStore.getState().encerrarGesto();
  };

  const b = elemento.bounds;
  const chave = chaveDoCaminho(caminho);

  return (
    <div
      data-testid={`el-${chave}`}
      data-selecionado={selecionado || undefined}
      onPointerDown={iniciar('mover')}
      onPointerMove={mover}
      onPointerUp={terminar}
      onPointerCancel={terminar}
      style={{
        position: 'absolute',
        left: ptParaPx(b.x, zoom),
        top: ptParaPx(b.y, zoom),
        width: ptParaPx(b.width, zoom),
        height: ptParaPx(b.height, zoom),
        boxSizing: 'border-box',
        cursor: 'move',
        outline: selecionado ? '2px solid var(--mantine-color-blue-6)' : '1px dotted var(--mantine-color-gray-4)',
        outlineOffset: -1,
        ...molduraDoKind(elemento),
      }}
    >
      {conteudo(elemento, zoom)}

      {selecionado &&
        DIRECOES.map((dir) => (
          <div
            key={dir}
            data-testid={`handle-${dir}-${chave}`}
            onPointerDown={iniciar(dir)}
            onPointerMove={mover}
            onPointerUp={terminar}
            onPointerCancel={terminar}
            style={{
              position: 'absolute',
              width: 7,
              height: 7,
              background: 'white',
              border: '1px solid var(--mantine-color-blue-6)',
              cursor: CURSOR[dir],
              ...posicaoDoHandle(dir),
            }}
          />
        ))}
    </div>
  );
}

function posicaoDoHandle(dir: Direcao): CSSProperties {
  const c: CSSProperties = {};
  if (dir.includes('n')) c.top = -4;
  if (dir.includes('s')) c.bottom = -4;
  if (dir.includes('w')) c.left = -4;
  if (dir.includes('e')) c.right = -4;
  if (dir === 'n' || dir === 's') {
    c.left = '50%';
    c.marginLeft = -3.5;
  }
  if (dir === 'e' || dir === 'w') {
    c.top = '50%';
    c.marginTop = -3.5;
  }
  return c;
}
