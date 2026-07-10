/**
 * Régua em milímetros (RFC-004 §3) — tarefa phase-2/2.1.
 * SVG alinhado ao px da página sob o zoom atual; rótulos a cada 10mm.
 */
import { marcasDeRegua, ptParaPx } from './geometria';

export const ESPESSURA_REGUA = 24;

interface ReguaProps {
  orientacao: 'horizontal' | 'vertical';
  comprimentoPt: number;
  zoom: number;
}

export function Regua({ orientacao, comprimentoPt, zoom }: ReguaProps) {
  const comprimentoPx = ptParaPx(comprimentoPt, zoom);
  const marcas = marcasDeRegua(comprimentoPt, zoom).filter((m) => m.tipo !== 'menor' || zoom >= 1);
  const horizontal = orientacao === 'horizontal';

  const tamanho = (tipo: 'maior' | 'media' | 'menor') => (tipo === 'maior' ? 10 : tipo === 'media' ? 6 : 3);

  return (
    <svg
      data-testid={`regua-${orientacao}`}
      aria-label={`régua ${orientacao} em milímetros`}
      width={horizontal ? comprimentoPx : ESPESSURA_REGUA}
      height={horizontal ? ESPESSURA_REGUA : comprimentoPx}
      style={{ display: 'block', background: 'var(--mantine-color-gray-1)' }}
    >
      {marcas.map((m) => {
        const t = tamanho(m.tipo);
        return horizontal ? (
          <line key={m.mm} x1={m.px} y1={ESPESSURA_REGUA} x2={m.px} y2={ESPESSURA_REGUA - t} stroke="var(--mantine-color-gray-6)" strokeWidth={1} />
        ) : (
          <line key={m.mm} x1={ESPESSURA_REGUA} y1={m.px} x2={ESPESSURA_REGUA - t} y2={m.px} stroke="var(--mantine-color-gray-6)" strokeWidth={1} />
        );
      })}
      {marcas
        .filter((m) => m.tipo === 'maior' && m.mm > 0)
        .map((m) =>
          horizontal ? (
            <text key={m.mm} x={m.px + 2} y={9} fontSize={8} fill="var(--mantine-color-gray-7)">
              {m.mm}
            </text>
          ) : (
            <text
              key={m.mm}
              x={9}
              y={m.px + 2}
              fontSize={8}
              fill="var(--mantine-color-gray-7)"
              transform={`rotate(-90 9 ${m.px + 2})`}
            >
              {m.mm}
            </text>
          ),
        )}
    </svg>
  );
}
