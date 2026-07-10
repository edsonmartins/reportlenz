import { MantineProvider } from '@mantine/core';
import { REFERENCIA_FATURA, contarColunasFolha, eGrupoDeColunas } from '@reportlenz/jrxml-core';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/App';
import { useCanvasStore } from '../src/store/canvasStore';
import { useDocumentoStore, validarDocumento } from '../src/store/documentoStore';
import { agruparColunas, desagruparColunas, moverColunaDeTabela } from '../src/store/mutacoes';

/**
 * Fase 3, bloco 2 — editor de tabela: colunas (add/remove/reorder),
 * seções H/F, merge/split via grupos e binding ao contrato.
 */

const CAMINHO_TABELA = { banda: { tipo: 'detail', indice: 0 } as const, indice: 1 };

const tabela = () => {
  const el = useDocumentoStore.getState().template?.bands.detail[0]?.elements[1];
  if (el?.kind !== 'table') throw new Error('tabela não encontrada');
  return el;
};

function renderComTabelaSelecionada() {
  render(
    <MantineProvider>
      <App />
    </MantineProvider>,
  );
  const alvo = screen.getByTestId('el-detail[0]/1');
  fireEvent.pointerDown(alvo, { pointerId: 1 });
  fireEvent.pointerUp(alvo, { pointerId: 1 });
  return screen.getByTestId('editor-de-tabela');
}

describe('jrxml-designer-react · editor de tabela (Fase 3, bloco 2)', () => {
  beforeEach(() => {
    useDocumentoStore.getState().fecharDocumento();
    useCanvasStore.setState({ zoom: 1, mostrarGrid: false, passoGridMm: 5, snapAtivo: false, guiasDeSnap: null });
    useDocumentoStore.getState().novoDocumento(structuredClone(REFERENCIA_FATURA));
  });

  it('merge/split puros preservam o documento válido', () => {
    const antes = useDocumentoStore.getState().template!;
    const agrupado = agruparColunas(CAMINHO_TABELA, 0, 'Itens')(antes);
    const t = agrupado.bands.detail[0]?.elements[1];
    if (t?.kind !== 'table') throw new Error('inesperado');
    expect(t.columns).toHaveLength(1);
    expect(eGrupoDeColunas(t.columns[0]!)).toBe(true);
    expect(t.columns[0]!.width).toBe(555); // 355+200
    expect(contarColunasFolha(t.columns)).toBe(2);
    expect(validarDocumento(agrupado)).toEqual([]);

    const separado = desagruparColunas(CAMINHO_TABELA, 0)(agrupado);
    const t2 = separado.bands.detail[0]?.elements[1];
    if (t2?.kind !== 'table') throw new Error('inesperado');
    expect(t2.columns).toHaveLength(2);
    expect(validarDocumento(separado)).toEqual([]);
  });

  it('reorder move grupos como unidade', () => {
    const base = useDocumentoStore.getState().template!;
    const movido = moverColunaDeTabela(CAMINHO_TABELA, 0, 1)(base);
    const t = movido.bands.detail[0]?.elements[1];
    if (t?.kind !== 'table') throw new Error('inesperado');
    const primeira = t.columns[0];
    if (!primeira || eGrupoDeColunas(primeira)) throw new Error('inesperado');
    expect(primeira.detail.elements[0]?.kind).toBe('textField');
    expect(primeira.width).toBe(200); // a antiga segunda
  });

  it('adicionar coluna ligada ao contrato (binding 2.4) — o canvas conta as folhas', () => {
    const editor = renderComTabelaSelecionada();

    // Antes de adicionar, precisa haver o campo no contrato: itens já tem descricao/valor.
    fireEvent.click(within(editor).getByLabelText('campo do contrato para a nova coluna'));
    fireEvent.click(screen.getByRole('option', { name: 'valor' }));
    fireEvent.click(within(editor).getByRole('button', { name: 'Adicionar coluna' }));

    expect(tabela().columns).toHaveLength(3);
    const nova = tabela().columns[2];
    if (!nova || eGrupoDeColunas(nova)) throw new Error('inesperado');
    expect(nova.detail.elements[0]?.kind === 'textField' && nova.detail.elements[0].expression).toBe('$F{valor}');
    expect(nova.detail.elements[0]?.kind === 'textField' && nova.detail.elements[0].pattern).toBe('#,##0.00'); // decimal → padrão
    expect(useDocumentoStore.getState().problemas).toEqual([]);
    expect(screen.getByText(/tabela · \$F\{itens\} · 3 col/)).toBeInTheDocument();
  });

  it('H/F alternam seções; merge/split e remover funcionam pela UI', () => {
    const editor = renderComTabelaSelecionada();

    // A coluna 0 tem header → desliga
    fireEvent.click(within(editor).getByRole('button', { name: 'cabeçalho da coluna 0' }));
    const col0 = tabela().columns[0];
    if (!col0 || eGrupoDeColunas(col0)) throw new Error('inesperado');
    expect(col0.header).toBeUndefined();

    // Merge das duas colunas → grupo; Split desfaz
    fireEvent.click(within(editor).getByRole('button', { name: 'agrupar 0' }));
    expect(tabela().columns).toHaveLength(1);
    expect(screen.getByText(/\[grupo\] Grupo/)).toBeInTheDocument();

    fireEvent.click(within(editor).getByRole('button', { name: 'desagrupar 0' }));
    expect(tabela().columns).toHaveLength(2);

    // Remover a última
    fireEvent.click(within(editor).getByRole('button', { name: 'remover coluna 1' }));
    expect(tabela().columns).toHaveLength(1);
    expect(useDocumentoStore.getState().problemas).toEqual([]);
  });
});
