import { MantineProvider } from '@mantine/core';
import { REFERENCIA_FATURA } from '@reportlenz/jrxml-core';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/App';
import { useCanvasStore } from '../src/store/canvasStore';
import { useDocumentoStore, validarDocumento } from '../src/store/documentoStore';
import { adicionarEstilo, atualizarEstilo, removerEstilo } from '../src/store/mutacoes';

/**
 * Fase 3, bloco 4 — estilos na UI: nomeados com herança (4.1) e estilos
 * condicionais com expression editor (4.2).
 */

function renderApp() {
  return render(
    <MantineProvider>
      <App />
    </MantineProvider>,
  );
}

const estilos = () => useDocumentoStore.getState().template!.styles;

describe('jrxml-designer-react · estilos (Fase 3, bloco 4)', () => {
  beforeEach(() => {
    useDocumentoStore.getState().fecharDocumento();
    useCanvasStore.setState({ zoom: 1, mostrarGrid: false, passoGridMm: 5, snapAtivo: false, guiasDeSnap: null });
    useDocumentoStore.getState().novoDocumento(structuredClone(REFERENCIA_FATURA));
  });

  it('mutações puras: criar (nome duplicado é ignorado), default exclusivo, remover', () => {
    const base = useDocumentoStore.getState().template!;

    const criado = adicionarEstilo('destaque')(base);
    expect(criado.styles.map((s) => s.name)).toContain('destaque');
    expect(adicionarEstilo('base')(base).styles).toHaveLength(base.styles.length); // duplicado ignorado

    // 'base' é default; tornar 'linha_zebrada' default limpa o de 'base'.
    const trocado = atualizarEstilo('linha_zebrada', { isDefault: true })(criado);
    expect(trocado.styles.find((s) => s.name === 'linha_zebrada')?.isDefault).toBe(true);
    expect(trocado.styles.find((s) => s.name === 'base')?.isDefault).toBeUndefined();
    expect(validarDocumento(trocado)).toEqual([]);

    // Remover estilo em uso → checker acusa styleRef órfão (honesto, não bloqueia).
    const semBase = removerEstilo('base')(base);
    expect(validarDocumento(semBase).some((p) => p.message.includes('base'))).toBe(true);
  });

  it('sem seleção, o painel direito vira o gerenciador de estilos', () => {
    renderApp();
    expect(screen.getByTestId('gerenciador-de-estilos')).toBeInTheDocument();
    expect(screen.getByTestId('estilo-base')).toBeInTheDocument();
    expect(screen.getByTestId('estilo-linha_zebrada')).toBeInTheDocument();
  });

  it('criar estilo pela UI e usá-lo num elemento (herança visual fecha o ciclo)', () => {
    renderApp();
    const gerenciador = screen.getByTestId('gerenciador-de-estilos');

    const nome = within(gerenciador).getByRole('textbox', { name: 'nome do novo estilo' });
    fireEvent.change(nome, { target: { value: 'destaque' } });
    fireEvent.keyDown(nome, { key: 'Enter' });
    expect(estilos().some((s) => s.name === 'destaque')).toBe(true);

    // Edita a fonte do novo estilo
    fireEvent.click(within(screen.getByTestId('estilo-destaque')).getByRole('button', { name: /destaque/ }));
    const fonte = screen.getByRole('textbox', { name: 'fonte de destaque' });
    fireEvent.change(fonte, { target: { value: 'Arial' } });
    expect(estilos().find((s) => s.name === 'destaque')?.fontName).toBe('Arial');

    // Seleciona um elemento e aponta o styleRef para o novo estilo
    const alvo = screen.getByTestId('el-title/0');
    fireEvent.pointerDown(alvo, { pointerId: 1 });
    fireEvent.pointerUp(alvo, { pointerId: 1 });
    const linhaEstilo = screen.getByTestId('prop-styleRef');
    // O Select do Mantine tem input visível + input oculto com o mesmo valor.
    fireEvent.click(within(linhaEstilo).getAllByDisplayValue('base')[0]!);
    fireEvent.click(screen.getByRole('option', { name: 'destaque' }));

    // Herança visual: a fonte agora vem de 'destaque' (herdada, cinza)
    expect(screen.getByTestId('prop-fontName')).toHaveAttribute('data-herdado');
    expect(screen.getByRole('textbox', { name: 'Fonte' })).toHaveValue('Arial');
    expect(useDocumentoStore.getState().problemas).toEqual([]);
  });

  it('condições (4.2): zebra por padrão; expressão órfã acende o checker', () => {
    renderApp();
    fireEvent.click(within(screen.getByTestId('estilo-base')).getByRole('button', { name: /base/ }));
    fireEvent.click(screen.getByRole('button', { name: '+ condição (zebra por padrão)' }));

    const base = estilos().find((s) => s.name === 'base');
    expect(base?.conditionalStyles?.[0]?.conditionExpression).toBe('$V{REPORT_COUNT} % 2 == 0');
    expect(base?.conditionalStyles?.[0]?.style.backcolor).toBe('#F0F0F0');
    expect(useDocumentoStore.getState().problemas).toEqual([]);

    // Troca a condição por uma referência órfã → validação contínua acusa
    const editor = screen.getByRole('textbox', { name: 'condição 0 de base' });
    fireEvent.change(editor, { target: { value: '$F{fantasma} != null', selectionStart: 20 } });
    fireEvent.blur(editor);
    expect(useDocumentoStore.getState().problemas.some((p) => p.code === 'EXPR_UNKNOWN_REF')).toBe(true);

    // Remover a condição limpa o problema
    fireEvent.click(screen.getByRole('button', { name: 'remover condição 0 de base' }));
    expect(estilos().find((s) => s.name === 'base')?.conditionalStyles).toBeUndefined();
    expect(useDocumentoStore.getState().problemas).toEqual([]);
  });
});
