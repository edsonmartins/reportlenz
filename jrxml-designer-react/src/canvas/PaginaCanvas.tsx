/**
 * A folha (RFC-004 §3, tarefa phase-2/2.1): página em pt sob zoom, com
 * margens tracejadas, guias de coluna (etiqueta A4 multi-coluna) e grid
 * configurável em mm. As bandas entram na tarefa 2.2 como filhos.
 */
import type { PageFormat } from '@reportlenz/jrxml-core';
import type { ReactNode } from 'react';
import { areaUtil, colunasDaPagina, linhasDeGrid, ptParaPx } from './geometria';

interface PaginaCanvasProps {
  pageFormat: PageFormat;
  zoom: number;
  mostrarGrid: boolean;
  passoGridMm: number;
  children?: ReactNode;
}

export function PaginaCanvas({ pageFormat, zoom, mostrarGrid, passoGridMm, children }: PaginaCanvasProps) {
  const larguraPx = ptParaPx(pageFormat.pageWidth, zoom);
  const alturaPx = ptParaPx(pageFormat.pageHeight, zoom);
  const util = areaUtil(pageFormat);
  const colunas = colunasDaPagina(pageFormat);
  const grid = mostrarGrid ? linhasDeGrid(pageFormat, passoGridMm) : null;

  return (
    <div
      data-testid="pagina-canvas"
      style={{
        position: 'relative',
        width: larguraPx,
        height: alturaPx,
        background: 'white',
        boxShadow: '0 1px 6px rgba(0,0,0,0.25)',
      }}
    >
      <svg width={larguraPx} height={alturaPx} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {/* Grid da área útil */}
        {grid?.verticaisPt.map((x) => (
          <line
            key={`v${x}`}
            x1={ptParaPx(x, zoom)}
            y1={ptParaPx(util.y, zoom)}
            x2={ptParaPx(x, zoom)}
            y2={ptParaPx(util.y + util.height, zoom)}
            stroke="var(--mantine-color-blue-1)"
            strokeWidth={1}
          />
        ))}
        {grid?.horizontaisPt.map((y) => (
          <line
            key={`h${y}`}
            x1={ptParaPx(util.x, zoom)}
            y1={ptParaPx(y, zoom)}
            x2={ptParaPx(util.x + util.width, zoom)}
            y2={ptParaPx(y, zoom)}
            stroke="var(--mantine-color-blue-1)"
            strokeWidth={1}
          />
        ))}

        {/* Margens (tracejado) */}
        <rect
          data-testid="guia-margens"
          x={ptParaPx(util.x, zoom)}
          y={ptParaPx(util.y, zoom)}
          width={ptParaPx(util.width, zoom)}
          height={ptParaPx(util.height, zoom)}
          fill="none"
          stroke="var(--mantine-color-gray-5)"
          strokeDasharray="4 3"
          strokeWidth={1}
        />

        {/* Guias de coluna (só quando multi-coluna) */}
        {colunas.length > 1 &&
          colunas.map((c, i) => (
            <rect
              key={i}
              data-testid="guia-coluna"
              x={ptParaPx(c.x, zoom)}
              y={ptParaPx(c.y, zoom)}
              width={ptParaPx(c.width, zoom)}
              height={ptParaPx(c.height, zoom)}
              fill="none"
              stroke="var(--mantine-color-violet-4)"
              strokeDasharray="2 3"
              strokeWidth={1}
            />
          ))}
      </svg>
      {children}
    </div>
  );
}
