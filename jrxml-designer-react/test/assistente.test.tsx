import { MantineProvider } from '@mantine/core';
import { REFERENCIA_FATURA } from '@reportlenz/jrxml-core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { normalizarDraft } from '../src/assistente/normalizarDraft';
import { useCanvasStore } from '../src/store/canvasStore';
import { useDocumentoStore, validarDocumento } from '../src/store/documentoStore';

/**
 * Fase 4, Assistente A — NL → relatório (RFC-005 §2, ADR-014, tarefas 2.3/2.4):
 * o drawer envia descrição+contrato, valida o draft com o jrxml-core ANTES de
 * exibir e carrega como UM commit (desfazer volta ao documento anterior).
 */

const DRAFT_VALIDO = {
  name: 'recibo_ia',
  pageFormat: { pageWidth: 595, pageHeight: 842, leftMargin: 20, rightMargin: 20, topMargin: 30, bottomMargin: 30, columnCount: 1, columnWidth: 555, columnSpacing: 0 },
  properties: {},
  styles: [{ name: 'base', isDefault: true, fontName: 'DejaVu Sans', fontSize: 10 }],
  dataContract: {
    fields: [{ name: 'cliente', type: 'string' }],
    parameters: [{ name: 'titulo', type: 'string' }],
    variables: [],
  },
  bands: {
    title: {
      height: 40,
      splitType: 'Stretch',
      elements: [{ kind: 'textField', bounds: { x: 0, y: 0, width: 300, height: 20 }, expression: '$P{titulo}' }],
    },
    detail: [
      {
        height: 30,
        splitType: 'Stretch',
        elements: [{ kind: 'textField', bounds: { x: 0, y: 0, width: 300, height: 16 }, expression: '$F{cliente}' }],
      },
    ],
    groups: [],
  },
};

function respostaJson(status: number, corpo: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(corpo),
  } as Response;
}

function renderApp() {
  return render(
    <MantineProvider>
      <App />
    </MantineProvider>,
  );
}

function gerarComDescricao(descricao: string) {
  fireEvent.click(screen.getByRole('button', { name: '✨ Assistente' }));
  fireEvent.change(screen.getByLabelText('Descrição do relatório'), { target: { value: descricao } });
  fireEvent.click(screen.getByRole('button', { name: 'Gerar rascunho' }));
}

describe('jrxml-designer-react · Assistente A — NL → relatório (Fase 4)', () => {
  beforeEach(() => {
    useDocumentoStore.getState().fecharDocumento();
    useCanvasStore.setState({ zoom: 1, mostrarGrid: false, passoGridMm: 5, snapAtivo: false, guiasDeSnap: null });
    useDocumentoStore.getState().novoDocumento(structuredClone(REFERENCIA_FATURA));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('normalizarDraft: completa a forma estrutural e o draft de exemplo valida nos gates', () => {
    const t = normalizarDraft(structuredClone(DRAFT_VALIDO));
    expect(validarDocumento(t)).toEqual([]);
    // JSON capenga ganha as chaves estruturais (sem consertar elementos em silêncio).
    const capenga = normalizarDraft({ name: '  ', bands: {} });
    expect(capenga.name).toBe('relatorio_ia');
    expect(capenga.bands.detail).toEqual([]);
    expect(capenga.pageFormat.columnWidth).toBe(555); // derivado de A4 - margens
    expect(capenga.dataContract).toEqual({ fields: [], parameters: [], variables: [] });
  });

  it('gera rascunho válido, carrega no editor em um commit e desfazer volta ao anterior', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      respostaJson(200, { template: DRAFT_VALIDO, observacoes: 'esqueleto de recibo', modelo: 'openai/gpt-4o-mini' }),
    );
    vi.stubGlobal('fetch', fetchMock);
    renderApp();

    gerarComDescricao('recibo simples com título e nome do cliente');

    await waitFor(() => expect(screen.getByTestId('assistente-rascunho')).toBeInTheDocument());
    // Enviou descrição + contrato do documento aberto (vocabulário).
    const corpo = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string) as {
      descricao: string;
      contrato: { fields: unknown[] };
    };
    expect(fetchMock).toHaveBeenCalledWith('/assist/gerar-template', expect.objectContaining({ method: 'POST' }));
    expect(corpo.descricao).toContain('recibo simples');
    expect(corpo.contrato.fields.length).toBeGreaterThan(0);
    expect(screen.getByText(/Rascunho válido/)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('assistente-carregar'));
    expect(useDocumentoStore.getState().template?.name).toBe('recibo_ia');
    expect(useDocumentoStore.getState().problemas).toEqual([]);

    // Desfazer restaura a fatura (o draft entrou como UM commit).
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(useDocumentoStore.getState().template?.name).toBe('fatura_completa');
  });

  it('draft com referência fora do contrato mostra os problemas ANTES de carregar (2.4)', async () => {
    const invalido = structuredClone(DRAFT_VALIDO);
    invalido.bands.detail[0]!.elements[0]!.expression = '$F{nao_existe}';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      respostaJson(200, { template: invalido, observacoes: '', modelo: 'openai/gpt-4o-mini' }),
    ));
    renderApp();

    gerarComDescricao('recibo');

    await waitFor(() => expect(screen.getByTestId('assistente-problemas')).toBeInTheDocument());
    expect(screen.getByTestId('assistente-problemas').textContent).toContain('EXPR_UNKNOWN_REF');
  });

  it('503 degrada com mensagem de IA indisponível, sem quebrar o designer', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaJson(503, { codigo: 'IA_INDISPONIVEL' })));
    renderApp();

    gerarComDescricao('qualquer coisa');

    await waitFor(() => expect(screen.getByTestId('assistente-erro')).toBeInTheDocument());
    expect(screen.getByTestId('assistente-erro').textContent).toContain('IA indisponível');
    expect(useDocumentoStore.getState().template?.name).toBe('fatura_completa'); // intacto
  });
});
