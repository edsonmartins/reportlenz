import { MantineProvider } from '@mantine/core';
import { REFERENCIA_FATURA } from '@reportlenz/jrxml-core';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/App';
import { aplicarSugestao, contextoDoCursor, escopoMaster, sugestoesPara, validarExpressaoInline } from '../src/expression/sugestoes';
import { useCanvasStore } from '../src/store/canvasStore';
import { useDocumentoStore } from '../src/store/documentoStore';

/**
 * Fase 3, bloco 1 — expression editor: autocomplete sobre o contrato (1.1),
 * validação inline de sintaxe/nomes (1.2) e funções jasperreports (1.3).
 */

const ESCOPO = escopoMaster(REFERENCIA_FATURA.dataContract, ['por_categoria']);

describe('jrxml-designer-react · motor de sugestões (1.1-1.3, puro)', () => {
  it('contexto: dentro de $F{ sugere fields filtrados pelo prefixo', () => {
    const texto = 'x + $F{cli';
    const ctx = contextoDoCursor(texto, texto.length);
    expect(ctx).toMatchObject({ tipo: 'ref', kind: 'F', prefixo: 'cli' });

    const sugestoes = sugestoesPara(ctx, ESCOPO);
    expect(sugestoes.map((s) => s.rotulo)).toEqual(['cliente_nome']);

    const aplicado = aplicarSugestao(texto, texto.length, ctx!, sugestoes[0]!);
    expect(aplicado.texto).toBe('x + $F{cliente_nome}');
    expect(aplicado.cursor).toBe(aplicado.texto.length);
  });

  it('escopo completo: $P inclui built-ins; $V inclui {grupo}_COUNT', () => {
    const ctxP = contextoDoCursor('$P{REPORT_LO', 12);
    expect(sugestoesPara(ctxP, ESCOPO).map((s) => s.rotulo)).toContain('REPORT_LOCALE');

    const ctxV = contextoDoCursor('$V{por_', 7);
    expect(sugestoesPara(ctxV, ESCOPO).map((s) => s.rotulo)).toContain('por_categoria_COUNT');
  });

  it('funções (1.3): palavra solta sugere o catálogo jasperreports-functions', () => {
    const ctx = contextoDoCursor('DATEF', 5);
    expect(ctx).toMatchObject({ tipo: 'funcao', prefixo: 'DATEF' });
    const sugestoes = sugestoesPara(ctx, ESCOPO);
    expect(sugestoes[0]?.rotulo).toContain('DATEFORMAT');
    expect(aplicarSugestao('DATEF', 5, ctx!, sugestoes[0]!).texto).toBe('DATEFORMAT(');
  });

  it('validação inline (1.2): chave aberta e referência órfã', () => {
    expect(validarExpressaoInline('$F{cliente_nome}', ESCOPO)).toEqual([]);
    expect(validarExpressaoInline('$F{aberto', ESCOPO)[0]?.mensagem).toContain('sem fechar');
    expect(validarExpressaoInline('$F{nao_existe}', ESCOPO)[0]?.mensagem).toContain('não existe no contrato');
    expect(validarExpressaoInline('$V{}', ESCOPO)[0]?.mensagem).toContain('vazio');
  });
});

describe('jrxml-designer-react · ExpressionEditor no painel', () => {
  beforeEach(() => {
    useDocumentoStore.getState().fecharDocumento();
    useCanvasStore.setState({ zoom: 1, mostrarGrid: false, passoGridMm: 5, snapAtivo: false, guiasDeSnap: null });
    useDocumentoStore.getState().novoDocumento(structuredClone(REFERENCIA_FATURA));
  });

  function abrirExpressaoDoTitulo() {
    render(
      <MantineProvider>
        <App />
      </MantineProvider>,
    );
    const alvo = screen.getByTestId('el-title/0');
    fireEvent.pointerDown(alvo, { pointerId: 1 });
    fireEvent.pointerUp(alvo, { pointerId: 1 });
    return screen.getByRole('textbox', { name: 'Expressão' });
  }

  it('digitar $F{ abre sugestões do contrato; Enter completa e commita no blur', () => {
    const input = abrirExpressaoDoTitulo();

    fireEvent.change(input, { target: { value: '$F{ite', selectionStart: 6 } });
    expect(screen.getByTestId('sugestoes')).toBeInTheDocument();
    expect(screen.getByTestId('sugestao-0')).toHaveTextContent('itens');

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(input).toHaveValue('$F{itens}');

    fireEvent.blur(input);
    const el = useDocumentoStore.getState().template?.bands.title?.elements[0];
    expect(el?.kind === 'textField' && el.expression).toBe('$F{itens}');
  });

  it('referência órfã mostra erro inline antes do commit; ao commitar vai ao checker', () => {
    const input = abrirExpressaoDoTitulo();

    fireEvent.change(input, { target: { value: '$P{fantasma}', selectionStart: 12 } });
    expect(screen.getByTestId('expressao-problema')).toHaveTextContent('não existe no contrato');

    fireEvent.blur(input);
    expect(useDocumentoStore.getState().problemas.some((p) => p.code === 'EXPR_UNKNOWN_REF')).toBe(true);
  });

  it('setas navegam as sugestões; Escape fecha', () => {
    const input = abrirExpressaoDoTitulo();

    fireEvent.change(input, { target: { value: '$P{', selectionStart: 3 } });
    const antes = screen.getByTestId('sugestao-0');
    expect(antes).toHaveAttribute('data-ativa');

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getByTestId('sugestao-1')).toHaveAttribute('data-ativa');

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByTestId('sugestoes')).not.toBeInTheDocument();
  });
});
