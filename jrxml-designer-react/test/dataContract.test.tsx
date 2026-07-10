import { MantineProvider } from '@mantine/core';
import { REFERENCIA_COMPROVANTE, REFERENCIA_FATURA } from '@reportlenz/jrxml-core';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/App';
import { useCanvasStore } from '../src/store/canvasStore';
import { useDocumentoStore } from '../src/store/documentoStore';

/**
 * Bloco 4 — DataContractPanel (ADR-003): declara fields/params/vars e gera o
 * inputSchema via core; SEM Query Editor/JDBC/Query Preview (cenário do spec).
 */

function renderApp() {
  return render(
    <MantineProvider>
      <App />
    </MantineProvider>,
  );
}

const contrato = () => useDocumentoStore.getState().template!.dataContract;

describe('jrxml-designer-react · DataContractPanel (4.1-4.2)', () => {
  beforeEach(() => {
    useDocumentoStore.getState().fecharDocumento();
    useCanvasStore.setState({ zoom: 1, mostrarGrid: false, passoGridMm: 5, snapAtivo: false, guiasDeSnap: null });
    useDocumentoStore.getState().novoDocumento(structuredClone(REFERENCIA_FATURA));
  });

  it('lista o contrato do template e pergunta "quais campos", nunca "qual query"', () => {
    renderApp();
    const painel = screen.getByTestId('data-contract-panel');
    expect(within(painel).getByText(/Quais campos este relatório espera/)).toBeInTheDocument();
    expect(screen.getByTestId('field-categoria')).toBeInTheDocument();
    expect(screen.getByTestId('field-itens')).toBeInTheDocument();

    // Cenário do spec: ausência TOTAL de caminho Pull no painel.
    expect(painel.textContent).not.toMatch(/query|sql|jdbc|conex/i);
  });

  it('adicionar um campo atualiza o contrato E o inputSchema ao vivo', () => {
    renderApp();
    const painel = screen.getByTestId('data-contract-panel');

    const nome = within(painel).getByRole('textbox', { name: 'nome do campo (ex.: cliente.nome)' });
    fireEvent.change(nome, { target: { value: 'observacao' } });
    fireEvent.keyDown(nome, { key: 'Enter' });

    expect(contrato().fields.some((f) => f.name === 'observacao' && f.type === 'string')).toBe(true);
    expect(screen.getByTestId('input-schema').textContent).toContain('"observacao"');
    expect(useDocumentoStore.getState().problemas).toEqual([]);
  });

  it('marcar obrigatório entra no required do inputSchema', () => {
    renderApp();
    fireEvent.click(screen.getByRole('checkbox', { name: 'obrigatório categoria' }));

    expect(contrato().fields.find((f) => f.name === 'categoria')?.required).toBe(true);
    const schema = JSON.parse(screen.getByTestId('input-schema').textContent ?? '{}') as { required?: string[] };
    expect(schema.required).toContain('categoria');
  });

  it('coleção expande itemFields; adicionar campo de item reflete no array do schema', () => {
    renderApp();
    const painel = screen.getByTestId('data-contract-panel');

    const nomeItem = within(painel).getByRole('textbox', { name: 'campo do item de itens' });
    fireEvent.change(nomeItem, { target: { value: 'unidade' } });
    fireEvent.keyDown(nomeItem, { key: 'Enter' });

    const itens = contrato().fields.find((f) => f.name === 'itens');
    expect(itens?.itemFields?.some((i) => i.name === 'unidade')).toBe(true);
    const schema = screen.getByTestId('input-schema').textContent ?? '';
    expect(schema).toContain('"unidade"');
  });

  it('remover um campo usado por expressões acende o ReportChecker', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'remover categoria' }));

    expect(contrato().fields.some((f) => f.name === 'categoria')).toBe(false);
    // O grupo por_categoria usa $F{categoria} → referência órfã detectada na hora.
    expect(useDocumentoStore.getState().problemas.some((p) => p.code === 'EXPR_UNKNOWN_REF')).toBe(true);
    expect(screen.getByText(/problema\(s\)/)).toBeInTheDocument();
  });

  it('agrupamento pontuado aparece no schema (comprovante: pedido/cliente aninhados)', () => {
    useDocumentoStore.getState().novoDocumento(structuredClone(REFERENCIA_COMPROVANTE));
    renderApp();
    const schema = JSON.parse(screen.getByTestId('input-schema').textContent ?? '{}') as {
      $id?: string;
      properties?: Record<string, { type?: string }>;
    };
    expect(schema.$id).toBe('reportlenz:contract:comprovante_entrega:v1');
    expect(schema.properties?.['pedido']?.type).toBe('object');
    expect(schema.properties?.['cliente']?.type).toBe('object');
    expect(schema.properties?.['itens']?.type).toBe('array');
  });

  it('parâmetros e variáveis também são declaráveis (variável marcada como calculada)', () => {
    renderApp();
    const painel = screen.getByTestId('data-contract-panel');

    // Abre as seções recolhidas do Accordion.
    fireEvent.click(within(painel).getByRole('button', { name: /Parâmetros/ }));
    fireEvent.click(within(painel).getByRole('button', { name: /Variáveis/ }));

    const nomeParam = within(painel).getByRole('textbox', { name: 'nome do parâmetro' });
    fireEvent.change(nomeParam, { target: { value: 'empresa' } });
    fireEvent.keyDown(nomeParam, { key: 'Enter' });
    expect(contrato().parameters.some((p) => p.name === 'empresa')).toBe(true);

    const nomeVar = within(painel).getByRole('textbox', { name: 'nome da variável' });
    fireEvent.change(nomeVar, { target: { value: 'soma_itens' } });
    fireEvent.keyDown(nomeVar, { key: 'Enter' });
    expect(contrato().variables.some((v) => v.name === 'soma_itens' && v.calculation === 'Sum')).toBe(true);

    // Variável NÃO vaza para o payload (RFC-002 §2).
    expect(screen.getByTestId('input-schema').textContent).not.toContain('soma_itens');
    expect(screen.getByText(/calculadas, fora do payload/)).toBeInTheDocument();
  });
});
