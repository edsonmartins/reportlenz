/**
 * Estado do preview real (RFC-004 §7 / ADR-008, tarefa phase-2/5.2): o botão
 * "Renderizar (Jasper)" envia JRXML + sampleData + inputSchema ao
 * `POST /render/preview` e recebe PNG por página — a VERDADE do engine (I-8).
 */
import { buildInputSchema, datasourceCampo, extractContract, serializeJrxml } from '@reportlenz/jrxml-core';
import { create } from 'zustand';
import { useDocumentoStore } from '../store/documentoStore';
import { gerarDadosDeExemplo } from './dadosDeExemplo';

interface ErroDoServico {
  codigo?: string;
  mensagem?: string;
  violacoes?: string[];
}

export interface PreviewState {
  aberto: boolean;
  carregando: boolean;
  erro: string | null;
  violacoes: string[];
  imagemUrl: string | null;
  totalPaginas: number;
  pagina: number;

  abrir: () => void;
  fechar: () => void;
  renderizar: (pagina?: number) => Promise<void>;
}

export const usePreviewStore = create<PreviewState>((set, get) => ({
  aberto: false,
  carregando: false,
  erro: null,
  violacoes: [],
  imagemUrl: null,
  totalPaginas: 0,
  pagina: 0,

  abrir: () => {
    set({ aberto: true });
  },

  fechar: () => {
    const { imagemUrl } = get();
    if (imagemUrl) URL.revokeObjectURL(imagemUrl);
    set({ aberto: false, imagemUrl: null, erro: null, violacoes: [] });
  },

  renderizar: async (pagina = 0) => {
    const template = useDocumentoStore.getState().template;
    if (!template) return;

    set({ carregando: true, erro: null, violacoes: [], pagina });
    try {
      const contrato = extractContract(template);
      const resposta = await fetch('/render/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jrxml: serializeJrxml(template),
          sampleData: gerarDadosDeExemplo(contrato, { datasourceCampo: datasourceCampo(template) }),
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
