/**
 * Estado de VISUALIZAÇÃO do canvas (zoom, grid, réguas) — separado do
 * documento (documentoStore): mudar o zoom não é mutação do template.
 */
import { create } from 'zustand';

export interface CanvasState {
  /** px por pt (1 = 100%). */
  zoom: number;
  mostrarGrid: boolean;
  /** Passo do grid em mm (RFC-004 §3: grid com snap configurável). */
  passoGridMm: number;

  definirZoom: (zoom: number) => void;
  alternarGrid: () => void;
  definirPassoGrid: (mm: number) => void;
}

export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 4;

export const useCanvasStore = create<CanvasState>((set) => ({
  zoom: 1,
  mostrarGrid: true,
  passoGridMm: 5,

  definirZoom: (zoom) => {
    set({ zoom: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom)) });
  },
  alternarGrid: () => {
    set((s) => ({ mostrarGrid: !s.mostrarGrid }));
  },
  definirPassoGrid: (mm) => {
    set({ passoGridMm: Math.max(1, mm) });
  },
}));
