/**
 * Estado do preview real (RFC-004 §7 / ADR-008, tarefa phase-2/5.2): o botão
 * "Renderizar (Jasper)" envia JRXML + sampleData + inputSchema ao
 * `POST /render/preview` e recebe PNG por página — a VERDADE do engine (I-8).
 */
import { buildInputSchema, datasourceCampo, extractContract, serializeJrxml } from '@reportlenz/jrxml-core';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { ClienteDaApi } from '../api/cliente';
import { hookDoStore } from '../instancia';
import type { DocumentoState } from '../store/documentoStore';
import { camposDeCodigoDeBarras, dadosDoCatalogo, gerarDadosDeExemplo } from './dadosDeExemplo';

interface ErroDoServico {
  codigo?: string;
  mensagem?: string;
  violacoes?: string[];
}

/** Abas da área de trabalho (ADR-024). */
export type Aba = 'editor' | 'preview';

/** Zoom do preview: ajustar à largura, página inteira ou percentual (1 = 100%). */
export type ZoomDoPreview = 'largura' | 'pagina' | number;

export interface PreviewState {
  aba: Aba;
  zoom: ZoomDoPreview;
  carregando: boolean;
  erro: string | null;
  violacoes: string[];
  imagemUrl: string | null;
  totalPaginas: number;
  pagina: number;
  /**
   * JRXML do último render pedido (ADR-024): diferente do documento atual =
   * preview desatualizado — a aba avisa e renderiza de novo ao ser aberta.
   */
  jrxmlRenderizado: string | null;

  irPara: (aba: Aba) => void;
  definirZoom: (zoom: ZoomDoPreview) => void;
  /** Documento novo: volta ao editor e descarta o render anterior. */
  reiniciar: () => void;
  renderizar: (pagina?: number) => Promise<void>;
}

/** Fábrica ligada ao documento e ao cliente de API da MESMA instância (ADR-025 §3). */
export function criarPreviewStore(documento: StoreApi<DocumentoState>, api: ClienteDaApi) {
  return createStore<PreviewState>()((set, get) => ({
  aba: 'editor',
  zoom: 'largura',
  carregando: false,
  erro: null,
  violacoes: [],
  imagemUrl: null,
  totalPaginas: 0,
  pagina: 0,
  jrxmlRenderizado: null,

  irPara: (aba) => set({ aba }),

  definirZoom: (zoom) => set({ zoom }),

  reiniciar: () => {
    const { imagemUrl } = get();
    if (imagemUrl) URL.revokeObjectURL(imagemUrl);
    set({ aba: 'editor', imagemUrl: null, erro: null, violacoes: [], totalPaginas: 0, pagina: 0, jrxmlRenderizado: null, carregando: false });
  },

  renderizar: async (pagina = 0) => {
    const template = documento.getState().template;
    if (!template) return;

    const jrxml = serializeJrxml(template);
    set({ carregando: true, erro: null, violacoes: [], pagina, jrxmlRenderizado: jrxml });
    try {
      const contrato = extractContract(template);
      const resposta = await api('/render/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jrxml,
          // Modelo do catálogo intacto → cenário típico realista (ADR-022); senão, genéricos.
          sampleData:
            dadosDoCatalogo(template) ??
            gerarDadosDeExemplo(contrato, {
              datasourceCampo: datasourceCampo(template),
              codigosDeBarras: camposDeCodigoDeBarras(template),
            }),
          inputSchema: buildInputSchema(contrato, { templateName: template.name, version: 1 }),
          format: 'png',
          page: pagina,
        }),
      });

      if (!resposta.ok) {
        const corpo = (await resposta.json().catch(() => ({}))) as ErroDoServico;
        set({
          carregando: false,
          erro: corpo.mensagem ?? `render falhou (HTTP ${resposta.status})`,
          violacoes: corpo.violacoes ?? [],
        });
        return;
      }

      const blob = await resposta.blob();
      const anterior = get().imagemUrl;
      if (anterior) URL.revokeObjectURL(anterior);
      set({
        carregando: false,
        imagemUrl: URL.createObjectURL(blob),
        totalPaginas: Number(resposta.headers.get('X-Total-Pages') ?? '1'),
      });
    } catch (e) {
      set({
        carregando: false,
        erro: `serviço de render indisponível: ${e instanceof Error ? e.message : String(e)}`,
      });
    }
  },
}));
}

/** Hook ciente da instância; `getState` estático = instância padrão. */
export const usePreviewStore = hookDoStore((i) => i.preview);
