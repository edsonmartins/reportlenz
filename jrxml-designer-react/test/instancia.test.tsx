import { MantineProvider } from '@mantine/core';
import { REFERENCIA_DANFE, REFERENCIA_FATURA } from '@archbase/reportlenz-jrxml-core';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../src/App';
import { criarInstanciaDoDesigner, obterInstanciaPadrao, ProvedorDeInstancia } from '../src/instancia';
import { useDocumentoStore } from '../src/store/documentoStore';

/**
 * Estado por instância (ADR-025 §3, change componente-embutivel/2.1):
 * Scenario "Duas instâncias na mesma página".
 */
function duasInstancias() {
  const a = criarInstanciaDoDesigner();
  const b = criarInstanciaDoDesigner();
  a.documento.getState().novoDocumento(structuredClone(REFERENCIA_FATURA));
  b.documento.getState().novoDocumento(structuredClone(REFERENCIA_DANFE));
  render(
    <MantineProvider>
      <div data-testid="designer-a">
        <ProvedorDeInstancia instancia={a}>
          <App />
        </ProvedorDeInstancia>
      </div>
      <div data-testid="designer-b">
        <ProvedorDeInstancia instancia={b}>
          <App />
        </ProvedorDeInstancia>
      </div>
    </MantineProvider>,
  );
  return { a, b, A: within(screen.getByTestId('designer-a')), B: within(screen.getByTestId('designer-b')) };
}

describe('jrxml-designer-react · estado por instância (ADR-025)', () => {
  it('cada provider mostra o SEU documento; a instância padrão não é tocada', () => {
    const { A, B } = duasInstancias();
    expect(A.getByText('fatura_completa')).toBeInTheDocument();
    expect(B.getByText('danfe_retrato')).toBeInTheDocument();
    expect(obterInstanciaPadrao().documento.getState().template).toBeNull();
    expect(useDocumentoStore.getState()).toBe(obterInstanciaPadrao().documento.getState());
  });

  it('mutar/desfazer numa instância não altera a outra', () => {
    const { a, b } = duasInstancias();
    const antesB = b.documento.getState().template;
    a.documento.getState().mutarTemplate((t) => ({ ...t, name: 'fatura_editada' }));
    expect(a.documento.getState().template?.name).toBe('fatura_editada');
    expect(b.documento.getState().template).toBe(antesB);
    expect(b.documento.getState().passado).toHaveLength(0);
  });

  it('abas independentes: Preview numa, Editor na outra', () => {
    const { a, b, A } = duasInstancias();
    fireEvent.click(A.getByRole('tab', { name: 'Preview (Jasper)' }));
    expect(a.preview.getState().aba).toBe('preview');
    expect(b.preview.getState().aba).toBe('editor');
  });

  it('teclado só age na instância clicada por último (setas não movem o outro designer)', () => {
    const { a, b, A } = duasInstancias();
    a.documento.getState().selecionar({ banda: { tipo: 'secao', secao: 'title' }, indice: 0 });
    b.documento.getState().selecionar({ banda: { tipo: 'secao', secao: 'title' }, indice: 0 });
    const xA = a.documento.getState().template!.bands.title!.elements[0]!.bounds.x;
    const xB = b.documento.getState().template!.bands.title!.elements[0]!.bounds.x;

    fireEvent.pointerDown(A.getByTestId('canvas'));
    fireEvent.keyDown(window, { key: 'ArrowRight' });

    expect(a.documento.getState().template!.bands.title!.elements[0]!.bounds.x).toBe(xA + 1);
    expect(b.documento.getState().template!.bands.title!.elements[0]!.bounds.x).toBe(xB);
  });
});
