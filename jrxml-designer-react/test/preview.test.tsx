import { MantineProvider } from '@mantine/core';
import { REFERENCIA_COMPROVANTE, REFERENCIA_FATURA } from '@reportlenz/jrxml-core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { gerarDadosDeExemplo } from '../src/preview/dadosDeExemplo';
import { usePreviewStore } from '../src/preview/previewStore';
import { useCanvasStore } from '../src/store/canvasStore';
import { useDocumentoStore } from '../src/store/documentoStore';

/**
 * Bloco 5 — preview: aproximação ROTULADA no canvas (5.1, I-8) e render real
 * via POST /render/preview com PNG paginado (5.2, ADR-008).
 */

function respostaPng(totalPaginas = 1): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'X-Total-Pages': String(totalPaginas), 'Content-Type': 'image/png' }),
    blob: () => Promise.resolve(new Blob(['png'], { type: 'image/png' })),
    json: () => Promise.resolve({}),
  } as unknown as Response;
}

function resposta422(): Response {
  return {
    ok: false,
    status: 422,
    headers: new Headers(),
    blob: () => Promise.resolve(new Blob()),
    json: () =>
      Promise.resolve({
        codigo: 'PAYLOAD_FORA_DO_CONTRATO',
        mensagem: 'payload não satisfaz o contrato',
        violacoes: ['$.cliente.nome: obrigatório'],
      }),
  } as unknown as Response;
}

function renderApp() {
  return render(
    <MantineProvider>
      <App />
    </MantineProvider>,
  );
}

describe('jrxml-designer-react · dados de exemplo (5.2, puro)', () => {
  it('gera payload aninhado que satisfaz o contrato do comprovante', () => {
    const payload = gerarDadosDeExemplo(REFERENCIA_COMPROVANTE.dataContract);
    const pedido = payload['pedido'] as Record<string, unknown>;
    expect(pedido['numero']).toBe('numero exemplo');
    expect(pedido['data']).toBe('2026-01-15');
    const itens = payload['itens'] as Array<Record<string, unknown>>;
    expect(itens).toHaveLength(2);
    expect(itens[0]).toMatchObject({ descricao: 'descricao exemplo', unidade: 'unidade exemplo' });
    expect(typeof itens[0]?.['quantidade']).toBe('number');
  });
});

describe('jrxml-designer-react · preview (5.1-5.2)', () => {
  beforeEach(() => {
    useDocumentoStore.getState().fecharDocumento();
    useCanvasStore.setState({ zoom: 1, mostrarGrid: false, passoGridMm: 5, snapAtivo: false, guiasDeSnap: null });
    usePreviewStore.setState({ aberto: false, carregando: false, erro: null, violacoes: [], imagemUrl: null, totalPaginas: 0, pagina: 0 });
    useDocumentoStore.getState().novoDocumento(structuredClone(REFERENCIA_FATURA));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('5.1: o canvas carrega o rótulo de aproximação (I-8)', () => {
    renderApp();
    expect(screen.getByTestId('rotulo-aproximacao')).toHaveTextContent('Aproximação — a verdade é o render Jasper');
  });

  it('Renderizar (Jasper) envia jrxml+sampleData+inputSchema e mostra o PNG', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respostaPng(1));
    vi.stubGlobal('fetch', fetchMock);
    renderApp();

    fireEvent.click(screen.getByRole('button', { name: 'Renderizar (Jasper)' }));

    await waitFor(() => expect(screen.getByTestId('preview-img')).toBeInTheDocument());

    expect(fetchMock).toHaveBeenCalledWith('/render/preview', expect.objectContaining({ method: 'POST' }));
    const corpo = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string) as {
      jrxml: string;
      sampleData: Record<string, unknown>;
      inputSchema: { $id?: string };
      format: string;
    };
    expect(corpo.jrxml).toContain('<jasperReport name="fatura_completa"');
    expect(corpo.jrxml).not.toContain('<query'); // anti-Pull até no preview
    expect(corpo.sampleData['cliente_nome']).toBe('cliente_nome exemplo');
    expect(Array.isArray(corpo.sampleData['itens'])).toBe(true);
    expect(corpo.inputSchema.$id).toBe('reportlenz:contract:fatura_completa:v1');
    expect(corpo.format).toBe('png');
  });

  it('422 do serviço mostra as violações (sem imagem)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta422()));
    renderApp();

    fireEvent.click(screen.getByRole('button', { name: 'Renderizar (Jasper)' }));

    await waitFor(() => expect(screen.getByTestId('preview-erro')).toBeInTheDocument());
    expect(screen.getByText(/\$\.cliente\.nome: obrigatório/)).toBeInTheDocument();
    expect(screen.queryByTestId('preview-img')).not.toBeInTheDocument();
  });

  it('multi-página: mostra 1/3 e a próxima página pede page=1', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respostaPng(3));
    vi.stubGlobal('fetch', fetchMock);
    renderApp();

    fireEvent.click(screen.getByRole('button', { name: 'Renderizar (Jasper)' }));
    await waitFor(() => expect(screen.getByTestId('preview-paginacao')).toHaveTextContent('1 / 3'));

    fireEvent.click(screen.getByRole('button', { name: 'próxima página' }));
    await waitFor(() => expect(screen.getByTestId('preview-paginacao')).toHaveTextContent('2 / 3'));

    const ultimoCorpo = JSON.parse((fetchMock.mock.calls.at(-1)?.[1] as RequestInit).body as string) as { page: number };
    expect(ultimoCorpo.page).toBe(1);
  });

  it('serviço fora do ar vira mensagem, não tela branca', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    renderApp();

    fireEvent.click(screen.getByRole('button', { name: 'Renderizar (Jasper)' }));
    await waitFor(() => expect(screen.getByTestId('preview-erro')).toBeInTheDocument());
    expect(screen.getByText(/indisponível/)).toBeInTheDocument();
  });
});
