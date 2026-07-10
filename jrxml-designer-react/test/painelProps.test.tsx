import { MantineProvider } from '@mantine/core';
import { REFERENCIA_FATURA } from '@reportlenz/jrxml-core';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/App';
import { resolverPropDeEstilo } from '../src/props/heranca';
import { useCanvasStore } from '../src/store/canvasStore';
import { useDocumentoStore } from '../src/store/documentoStore';

/**
 * Bloco 3 — painel de propriedades: atributos JR (3.1), herança visual
 * cinza/preto com "voltar a herdar" (3.2) e filtro por nome (3.3).
 */

function renderApp() {
  return render(
    <MantineProvider>
      <App />
    </MantineProvider>,
  );
}

function selecionar(testid: string) {
  const alvo = screen.getByTestId(testid);
  fireEvent.pointerDown(alvo, { pointerId: 1 });
  fireEvent.pointerUp(alvo, { pointerId: 1 });
}

describe('jrxml-designer-react · herança de estilo (3.2, puro)', () => {
  it('resolve local > cadeia do styleRef > estilo default > engine', () => {
    const t = structuredClone(REFERENCIA_FATURA);
    // linha_zebrada herda de base (default, DejaVu Sans 10)
    const el = {
      kind: 'textField' as const,
      bounds: { x: 0, y: 0, width: 10, height: 10 },
      expression: '$F{categoria}',
      styleRef: 'linha_zebrada',
      style: { bold: true },
    };

    expect(resolverPropDeEstilo(t, el, 'bold')).toMatchObject({ valor: true, origem: 'local' });
    expect(resolverPropDeEstilo(t, el, 'mode')).toMatchObject({ valor: 'Transparent', origem: 'estiloNomeado', estilo: 'linha_zebrada' });
    expect(resolverPropDeEstilo(t, el, 'fontName')).toMatchObject({ valor: 'DejaVu Sans', origem: 'estiloNomeado', estilo: 'base' }); // subiu o parent
    expect(resolverPropDeEstilo(t, el, 'forecolor')).toMatchObject({ valor: undefined, origem: 'engine' });

    const semRef = { ...el, styleRef: undefined, style: undefined };
    expect(resolverPropDeEstilo(t, semRef, 'fontSize')).toMatchObject({ valor: 10, origem: 'estiloDefault', estilo: 'base' });
  });
});

describe('jrxml-designer-react · painel de propriedades (3.1-3.3)', () => {
  beforeEach(() => {
    useDocumentoStore.getState().fecharDocumento();
    useCanvasStore.setState({ zoom: 1, mostrarGrid: false, passoGridMm: 5, snapAtivo: false, guiasDeSnap: null });
    useDocumentoStore.getState().novoDocumento(structuredClone(REFERENCIA_FATURA));
  });

  it('sem seleção orienta; com seleção mostra os atributos do elemento', () => {
    renderApp();
    expect(screen.getByText('Selecione um elemento no canvas.')).toBeInTheDocument();

    selecionar('el-title/0'); // textField com styleRef base
    expect(screen.getByTestId('prop-x')).toBeInTheDocument();
    expect(screen.getByTestId('prop-expression')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Expressão' })).toHaveValue('$P{titulo}');
  });

  it('herança visual: herdado em cinza; sobrescrever escurece; × volta a herdar', () => {
    renderApp();
    selecionar('el-title/0');

    // fontName vem do estilo base via styleRef → herdado (cinza)
    expect(screen.getByTestId('prop-fontName')).toHaveAttribute('data-herdado');
    expect(screen.getByRole('textbox', { name: 'Fonte' })).toHaveValue('DejaVu Sans');

    // Sobrescreve → vira local (sem data-herdado) e o × aparece
    const fonte = screen.getByRole('textbox', { name: 'Fonte' });
    fireEvent.change(fonte, { target: { value: 'Roboto' } });
    fireEvent.blur(fonte);
    expect(screen.getByTestId('prop-fontName')).not.toHaveAttribute('data-herdado');
    const el = () => useDocumentoStore.getState().template?.bands.title?.elements[0];
    expect(el()?.style?.fontName).toBe('Roboto');

    // × remove a sobrescrita → volta a herdar
    fireEvent.click(screen.getByRole('button', { name: 'limpar Fonte' }));
    expect(screen.getByTestId('prop-fontName')).toHaveAttribute('data-herdado');
    expect(el()?.style?.fontName).toBeUndefined();
    expect(useDocumentoStore.getState().problemas).toEqual([]);
  });

  it('editar bounds pelo painel move o elemento no canvas', () => {
    renderApp();
    selecionar('el-title/0');

    const campoX = screen.getByRole('textbox', { name: 'X (pt)' });
    fireEvent.change(campoX, { target: { value: '40' } });

    expect(useDocumentoStore.getState().template?.bands.title?.elements[0]?.bounds.x).toBe(40);
    expect(screen.getByTestId('el-title/0').style.left).toBe('40px');
  });

  it('editar a expressão para uma ref órfã acende o ReportChecker (validação contínua)', () => {
    renderApp();
    selecionar('el-title/0');

    const expr = screen.getByRole('textbox', { name: 'Expressão' });
    fireEvent.change(expr, { target: { value: '$F{nao_existe}' } });
    fireEvent.blur(expr);

    expect(useDocumentoStore.getState().problemas.some((p) => p.code === 'EXPR_UNKNOWN_REF')).toBe(true);
    expect(screen.getByText('1 problema(s)')).toBeInTheDocument();
  });

  it('filtro por nome esconde as demais propriedades (3.3)', () => {
    renderApp();
    selecionar('el-title/0');

    fireEvent.change(screen.getByRole('textbox', { name: 'filtrar propriedades' }), { target: { value: 'fonte' } });

    expect(screen.getByTestId('prop-fontName')).toBeInTheDocument();
    expect(screen.getByTestId('prop-fontSize')).toBeInTheDocument();
    expect(screen.queryByTestId('prop-x')).not.toBeInTheDocument();
    expect(screen.queryByTestId('prop-expression')).not.toBeInTheDocument();
  });

  it('propriedades específicas por kind: barcode mostra tipo; tabela mostra a coleção', () => {
    renderApp();
    selecionar('el-detail[0]/2'); // QRCode da fatura
    expect(screen.getByTestId('prop-barcodeType')).toBeInTheDocument();

    selecionar('el-detail[0]/1'); // tabela
    expect(screen.getByText('$F{itens} · 2 coluna(s)')).toBeInTheDocument();
  });
});
