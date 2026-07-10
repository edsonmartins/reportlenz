/**
 * Estado de VISUALIZAÇÃO do canvas (zoom, grid, réguas) — separado do
 * documento (documentoStore): mudar o zoom não é mutação do template.
 */
import { create } from 'zustand';

/** Guias de alinhamento ativas durante um arraste (pt, espaço da banda). */
export interface GuiasDeSnap {
  banda: string;
  x: number | null;
  y: number | null;
}

export interface CanvasState {
  /** px por pt (1 = 100%). */
  zoom: number;
  mostrarGrid: boolean;
  /** Passo do grid em mm (RFC-004 §3: grid com snap configurável). */
  passoGridMm: number;
  /** Snapping (2.4) — Alt durante o arraste ignora pontualmente. */
  snapAtivo: boolean;
  guiasDeSnap: GuiasDeSnap | null;

  definirZoom: (zoom: number) => void;
  alternarGrid: () => void;
  definirPassoGrid: (mm: number) => void;
  alternarSnap: () => void;
  definirGuiasDeSnap: (guias: GuiasDeSnap | null) => void;
}

export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 4;

export const useCanvasStore = create<CanvasState>((set) => ({
  zoom: 1,
  mostrarGrid: true,
  passoGridMm: 5,
  snapAtivo: true,
  guiasDeSnap: null,

  definirZoom: (zoom) => {
    set({ zoom: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom)) });
  },
  alternarGrid: () => {
    set((s) => ({ mostrarGrid: !s.mostrarGrid }));
  },
  definirPassoGrid: (mm) => {
    set({ passoGridMm: Math.max(1, mm) });
  },
  alternarSnap: () => {
    set((s) => ({ snapAtivo: !s.snapAtivo }));
  },
  definirGuiasDeSnap: (guias) => {
    set({ guiasDeSnap: guias });
  },
}));
