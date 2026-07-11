import { MantineProvider } from '@mantine/core';
import { REFERENCIA_FATURA } from '@reportlenz/jrxml-core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { useCanvasStore } from '../src/store/canvasStore';
import { useDocumentoStore } from '../src/store/documentoStore';

/**
 * Fase 4, bloco 4 — Publish Wizard (RFC-006 §3, tarefas 4.1-4.3): checklist
 * G1–G6 nas duas camadas (jrxml-core + serviço/Library) e publish BLOQUEADO
 * se qualquer gate falhar ou se a autoridade estiver fora do ar.
 */

function respostaJson(status: number, corpo: unknown) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(corpo) } as Response;
}

const SERVICO_VERDE = {
  verde: true,
  gates: [
    { gate: 'G1', verde: true, erros: [] },
    { gate: 'G2', verde: true, erros: [] },
    { gate: 'G5', verde: true, erros: [] },
    { gate: 'G6', verde: true, erros: [] },
  ],
  jrxmlHash: 'abc',
};

function renderApp() {
  return render(
    <MantineProvider>
      <App />
    </MantineProvider>,
  );
}

function abrirWizard() {
  fireEvent.click(screen.getByRole('button', { name: 'Publicar…' }));
}

describe('jrxml-designer-react · Publish Wizard — gates G1–G6 (Fase 4, bloco 4)', () => {
  beforeEach(() => {
    useDocumentoStore.getState().fecharDocumento();
    useCanvasStore.setState({ zoom: 1, mostrarGrid: false, passoGridMm: 5, snapAtivo: false, guiasDeSnap: null });
    useDocumentoStore.getState().novoDocumento(structuredClone(REFERENCIA_FATURA));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('tudo verde: seis gates confirmados, versão publicada no repositório e pacote gerado', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === '/publish/verificar') return Promise.resolve(respostaJson(200, SERVICO_VERDE));
      if (url.endsWith('/publicar')) return Promise.resolve(respostaJson(200, { status: 'published', version: 3 }));
      if (url.includes('/templates/')) return Promise.resolve(respostaJson(200, { versionId: 'v', version: 3, novaVersao: true }));
      return Promise.reject(new Error(`URL inesperada: ${url}`));
    });
    vi.stubGlobal('fetch', fetchMock);
    renderApp();
    abrirWizard();

    await waitFor(() => expect(screen.getByText(/confirmado pela Library/)).toBeInTheDocument());
    for (const g of ['G1', 'G2', 'G3', 'G4', 'G5', 'G6']) {
      expect(screen.getByTestId(`gate-${g}`)).toHaveAttribute('data-verde');
    }
    // Enviou jrxml + inputSchema + hash para a verificação autoritativa.
    const corpo = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string) as {
      jrxml: string;
      jrxmlHash: string;
    };
    expect(corpo.jrxml).toContain('<jasperReport');
    expect(corpo.jrxmlHash).toMatch(/^[0-9a-f]{64}$/);

    const confirmar = screen.getByTestId('publish-confirmar');
    expect(confirmar).toBeEnabled();
    fireEvent.click(confirmar);

    // Publish persistente (bloco 5): salvar draft + publicar no repositório.
    await waitFor(() => expect(screen.getByTestId('publish-ok')).toBeInTheDocument());
    const urls = fetchMock.mock.calls.map((c) => c[0] as string);
    expect(urls).toContain('/templates/fatura_completa/versoes');
    expect(urls).toContain('/templates/fatura_completa/versoes/3/publicar');
    expect(screen.getByTestId('publish-ok').textContent).toContain('Versão 3 publicada');
  });

  it('G3 vermelho (expressão fora do contrato) BLOQUEIA o publish (4.3)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaJson(200, SERVICO_VERDE)));
    const invalido = structuredClone(REFERENCIA_FATURA);
    invalido.bands.title!.elements.push({
      kind: 'textField',
      bounds: { x: 0, y: 40, width: 100, height: 12 },
      expression: '$F{fantasma}',
    });
    useDocumentoStore.getState().novoDocumento(invalido);
    renderApp();
    abrirWizard();

    await waitFor(() => expect(screen.getByTestId('gate-G3')).toBeInTheDocument());
    expect(screen.getByTestId('gate-G3')).not.toHaveAttribute('data-verde');
    expect(screen.getAllByText(/fantasma/).length).toBeGreaterThan(0); // wizard + ReportChecker
    expect(screen.getByTestId('publish-confirmar')).toBeDisabled();
  });

  it('autoridade fora do ar: gates locais verdes NÃO bastam — publish bloqueado (I-5)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('rede fora')));
    renderApp();
    abrirWizard();

    await waitFor(() => expect(screen.getByTestId('publish-sem-autoridade')).toBeInTheDocument());
    expect(screen.getByTestId('publish-confirmar')).toBeDisabled();
  });

  it('Library reprova (G1 do serviço vermelho): checklist mostra e bloqueia', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaJson(200, {
      verde: false,
      gates: [
        { gate: 'G1', verde: false, erros: ['SCHEMA_INVALID: elemento recusado pela Library'] },
        { gate: 'G2', verde: true, erros: [] },
        { gate: 'G5', verde: true, erros: [] },
        { gate: 'G6', verde: true, erros: [] },
      ],
      jrxmlHash: 'abc',
    })));
    renderApp();
    abrirWizard();

    await waitFor(() => expect(screen.getByText(/recusado pela Library/)).toBeInTheDocument());
    expect(screen.getByTestId('gate-G1')).not.toHaveAttribute('data-verde');
    expect(screen.getByTestId('publish-confirmar')).toBeDisabled();
  });
});
