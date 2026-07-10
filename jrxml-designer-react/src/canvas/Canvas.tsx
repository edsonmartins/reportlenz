/**
 * Canvas do designer (RFC-004 §2-§3, tarefa phase-2/2.1): réguas mm nos dois
 * eixos + folha rolável. As bandas (2.2) e elementos (2.3) entram como filhos
 * da PaginaCanvas.
 */
import { useDocumentoStore } from '../store/documentoStore';
import { useCanvasStore } from '../store/canvasStore';
import { ESPESSURA_REGUA, Regua } from './Regua';
import { PaginaCanvas } from './PaginaCanvas';

const MARGEM_EM_TORNO_DA_FOLHA = 24;

export function Canvas() {
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
        <PaginaCanvas pageFormat={pf} zoom={zoom} mostrarGrid={mostrarGrid} passoGridMm={passoGridMm} />
      </div>
    </div>
  );
}
