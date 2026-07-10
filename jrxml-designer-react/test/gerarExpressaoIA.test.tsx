import { MantineProvider } from '@mantine/core';
import { REFERENCIA_FATURA } from '@reportlenz/jrxml-core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExpressionEditor } from '../src/expression/ExpressionEditor';
import { escopoMaster } from '../src/expression/sugestoes';

/**
 * Fase 4, Assistente B — NL → expressão (RFC-005 §3, tarefas 3.1-3.2): o ✨ do
 * ExpressionEditor manda pedido + vocabulário do ESCOPO, valida a expressão
 * devolvida com a mesma régua inline e só então oferece "Usar".
 */

const ESCOPO = escopoMaster(REFERENCIA_FATURA.dataContract, ['por_categoria']);

function respostaJson(status: number, corpo: unknown) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(corpo) } as Response;
}

function renderEditor(onCommit: (v: string) => void) {
  return render(
    <MantineProvider>
      <ExpressionEditor valor="" escopo={ESCOPO} onCommit={onCommit} aria-label="expressão" />
    </MantineProvider>,
  );
}

function pedir(texto: string) {
  fireEvent.click(screen.getByRole('button', { name: 'gerar expressão com IA' }));
  fireEvent.change(screen.getByLabelText('Pedido da expressão'), { target: { value: texto } });
  fireEvent.click(screen.getByRole('button', { name: 'Gerar' }));
}

describe('jrxml-designer-react · Assistente B — NL → expressão (Fase 4)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('gera, valida contra o escopo e "Usar" commita a expressão', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      respostaJson(200, { expressao: '"Cliente: " + $F{cliente_nome}', explicacao: 'concatenação', modelo: 'm' }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const onCommit = vi.fn();
    renderEditor(onCommit);

    pedir('rótulo Cliente seguido do nome do cliente');

    await waitFor(() => expect(screen.getByTestId('expressao-ia-sugerida')).toBeInTheDocument());
    // Vocabulário do escopo foi enviado (fields/parameters/variables).
    const corpo = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string) as {
      escopo: { fields: string[] };
    };
    expect(fetchMock).toHaveBeenCalledWith('/assist/gerar-expressao', expect.objectContaining({ method: 'POST' }));
    expect(corpo.escopo.fields).toContain('cliente_nome');
    expect(screen.queryByTestId('expressao-ia-problemas')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('expressao-ia-usar'));
    expect(onCommit).toHaveBeenCalledWith('"Cliente: " + $F{cliente_nome}');
  });

  it('expressão com nome fora do contrato mostra o problema antes do Usar (3.2)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      respostaJson(200, { expressao: '$F{nao_existe}', explicacao: '', modelo: 'm' }),
    ));
    renderEditor(vi.fn());

    pedir('campo inexistente');

    await waitFor(() => expect(screen.getByTestId('expressao-ia-problemas')).toBeInTheDocument());
    expect(screen.getByTestId('expressao-ia-problemas').textContent).toContain('nao_existe');
  });

  it('503 degrada com orientação para digitar manualmente', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respostaJson(503, { codigo: 'IA_INDISPONIVEL' })));
    renderEditor(vi.fn());

    pedir('qualquer');

    await waitFor(() => expect(screen.getByTestId('expressao-ia-erro')).toBeInTheDocument());
    expect(screen.getByTestId('expressao-ia-erro').textContent).toContain('IA indisponível');
  });
});
