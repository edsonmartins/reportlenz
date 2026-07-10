import { MantineProvider } from '@mantine/core';
import { REFERENCIA_FATURA } from '@reportlenz/jrxml-core';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/App';
import { useCanvasStore } from '../src/store/canvasStore';
import { useDocumentoStore, validarDocumento } from '../src/store/documentoStore';
import { adicionarGrupo, adicionarSubtotalAoGrupo, removerGrupo } from '../src/store/mutacoes';

/**
 * Fase 3, bloco 5 — grupos com subtotais (5.1) e subreports com contrato do
 * filho (5.2: parâmetros editáveis no painel).
 */

function renderApp() {
  return render(
    <MantineProvider>
      <App />
    </MantineProvider>,
  );
}

const doc = () => useDocumentoStore.getState().template!;

describe('jrxml-designer-react · grupos e subtotais (5.1)', () => {
  beforeEach(() => {
    useDocumentoStore.getState().fecharDocumento();
    useCanvasStore.setState({ zoom: 1, mostrarGrid: false, passoGridMm: 5, snapAtivo: false, guiasDeSnap: null });
    useDocumentoStore.getState().novoDocumento(structuredClone(REFERENCIA_FATURA));
  });

  it('mutações puras: criar grupo válido; subtotal cria variável + campo no rodapé', () => {
    const base = doc();
    // Campo numérico no contrato master p/ o subtotal.
    const comCampo = {
      ...base,
      dataContract: { ...base.dataContract, fields: [...base.dataContract.fields, { name: 'valor_frete', type: 'decimal' as const }] },
    };

    const comGrupo = adicionarGrupo('por_cidade', '$F{cliente_nome}')(comCampo);
    expect(comGrupo.bands.groups.map((g) => g.name)).toContain('por_cidade');
    expect(validarDocumento(comGrupo)).toEqual([]);

    const comSubtotal = adicionarSubtotalAoGrupo('por_cidade', { name: 'valor_frete', type: 'decimal' })(comGrupo);
    const variavel = comSubtotal.dataContract.variables.find((v) => v.name === 'soma_valor_frete_por_cidade');
    expect(variavel).toMatchObject({ calculation: 'Sum', resetType: 'Group', resetGroup: 'por_cidade', expression: '$F{valor_frete}' });

    const rodape = comSubtotal.bands.groups.find((g) => g.name === 'por_cidade')?.footer;
    const campo = rodape?.elements.at(-1);
    expect(campo?.kind === 'textField' && campo.expression).toBe('$V{soma_valor_frete_por_cidade}');
    expect(campo?.kind === 'textField' && campo.pattern).toBe('#,##0.00');
    expect(validarDocumento(comSubtotal)).toEqual([]);

    // Remover o grupo deixa a variável órfã → checker acusa (honesto).
    const semGrupo = removerGrupo('por_cidade')(comSubtotal);
    expect(validarDocumento(semGrupo).some((p) => p.message.includes('por_cidade'))).toBe(true);
  });

  it('UI completa: criar grupo, subtotal em um clique, bandas no canvas', () => {
    renderApp();
    fireEvent.click(screen.getByRole('tab', { name: 'Grupos' }));

    const gerenciador = screen.getByTestId('gerenciador-de-grupos');
    const nome = within(gerenciador).getByRole('textbox', { name: 'nome do novo grupo' });
    fireEvent.change(nome, { target: { value: 'por_cliente' } });
    fireEvent.keyDown(nome, { key: 'Enter' });

    expect(doc().bands.groups.map((g) => g.name)).toContain('por_cliente');
    expect(screen.getByTestId('banda-grupo:por_cliente:header')).toBeInTheDocument();
    expect(screen.getByTestId('banda-grupo:por_cliente:footer')).toBeInTheDocument();

    // Subtotal: itens é coleção; o campo numérico master não existe na fatura →
    // o select numérico oferece nada? A fatura não tem campo decimal master.
    // Adiciona um campo numérico pelo contrato e usa o subtotal.
    useDocumentoStore.getState().mutarTemplate((t) => ({
      ...t,
      dataContract: { ...t.dataContract, fields: [...t.dataContract.fields, { name: 'frete', type: 'decimal' }] },
    }));

    fireEvent.click(within(screen.getByTestId('grupo-por_cliente')).getByRole('button', { name: /por_cliente/ }));
    fireEvent.click(within(screen.getByTestId('grupo-por_cliente')).getByLabelText('campo do subtotal de por_cliente'));
    fireEvent.click(screen.getByRole('option', { name: 'frete' }));
    fireEvent.click(within(screen.getByTestId('grupo-por_cliente')).getByRole('button', { name: '+ Subtotal' }));

    expect(doc().dataContract.variables.some((v) => v.name === 'soma_frete_por_cliente')).toBe(true);
    expect(useDocumentoStore.getState().problemas).toEqual([]);
  });
});

describe('jrxml-designer-react · subreport com contrato do filho (5.2)', () => {
  beforeEach(() => {
    useDocumentoStore.getState().fecharDocumento();
    useCanvasStore.setState({ zoom: 1, mostrarGrid: false, passoGridMm: 5, snapAtivo: false, guiasDeSnap: null });
    useDocumentoStore.getState().novoDocumento(structuredClone(REFERENCIA_FATURA));
  });

  it('painel do subreport edita e adiciona parâmetros (expressões com autocomplete)', () => {
    renderApp();
    // O subreport da fatura está no summary, índice 1.
    const alvo = screen.getByTestId('el-summary/1');
    fireEvent.pointerDown(alvo, { pointerId: 1 });
    fireEvent.pointerUp(alvo, { pointerId: 1 });

    const params = screen.getByTestId('params-subreport');
    expect(within(params).getByText('cliente')).toBeInTheDocument();

    // Edita a expressão do parâmetro existente
    const editor = within(params).getByRole('textbox', { name: 'expressão do parâmetro cliente' });
    fireEvent.change(editor, { target: { value: '$F{categoria}', selectionStart: 13 } });
    fireEvent.blur(editor);
    const sub = () => {
      const el = doc().bands.summary?.elements[1];
      if (el?.kind !== 'subreport') throw new Error('inesperado');
      return el;
    };
    expect(sub().parameters[0]?.expression).toBe('$F{categoria}');

    // Adiciona um novo parâmetro e depois remove
    fireEvent.click(within(params).getByRole('button', { name: '+ parâmetro' }));
    expect(sub().parameters).toHaveLength(2);
    expect(sub().parameters[1]?.name).toBe('param2');

    fireEvent.click(within(params).getByRole('button', { name: 'remover parâmetro param2' }));
    expect(sub().parameters).toHaveLength(1);
    expect(useDocumentoStore.getState().problemas).toEqual([]);
  });
});
