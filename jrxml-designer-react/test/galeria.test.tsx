import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/App';
import { criarTemplateEmBranco } from '../src/galeria/Galeria';
import { validarDocumento, useDocumentoStore } from '../src/store/documentoStore';

/**
 * Bloco 7 — UX: galeria de templates pt-BR (7.2) e tooltips de
 * auto-explicação (7.1).
 */

function renderApp() {
  return render(
    <MantineProvider>
      <App />
    </MantineProvider>,
  );
}

describe('jrxml-designer-react · galeria (7.2)', () => {
  beforeEach(() => {
    useDocumentoStore.getState().fecharDocumento();
  });

  it('mostra os 5 modelos com descrições pt-BR', () => {
    renderApp();
    for (const chave of ['em_branco', 'fatura', 'comprovante', 'formulario', 'etiqueta_a4']) {
      expect(screen.getByTestId(`modelo-${chave}`)).toBeInTheDocument();
    }
    expect(screen.getByText('Comprovante de entrega')).toBeInTheDocument();
    expect(screen.getByText(/Térmica está fora de escopo/)).toBeInTheDocument(); // ADR-011 até na galeria
    expect(screen.getByText(/sem query embutida/)).toBeInTheDocument(); // contract-first na intro
    // Etiqueta anuncia as 3 colunas
    expect(within(screen.getByTestId('modelo-etiqueta_a4')).getByText('3 colunas')).toBeInTheDocument();
  });

  it('template em branco abre válido (0 problemas) e editável', () => {
    const t = criarTemplateEmBranco();
    expect(validarDocumento(t)).toEqual([]); // válido no dialeto 7 desde o nascimento

    renderApp();
    fireEvent.click(within(screen.getByTestId('modelo-em_branco')).getByRole('button', { name: 'Usar' }));

    expect(screen.getByTestId('pagina-canvas')).toBeInTheDocument();
    expect(screen.getByTestId('banda-detail[0]')).toBeInTheDocument();
    expect(screen.getByText('ok')).toBeInTheDocument();
    expect(useDocumentoStore.getState().template?.dataContract.fields).toEqual([]);
  });
});

describe('jrxml-designer-react · tooltips de auto-explicação (7.1)', () => {
  beforeEach(() => {
    useDocumentoStore.getState().fecharDocumento();
  });

  it('controles-chave explicam a si mesmos no hover', async () => {
    renderApp();
    fireEvent.click(within(screen.getByTestId('modelo-fatura')).getByRole('button', { name: 'Usar' }));

    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Snap' }));
    expect(await screen.findByText(/gruda em bordas\/centros vizinhos/)).toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByRole('button', { name: 'Renderizar (Jasper)' }));
    expect(await screen.findByText(/o canvas é aproximação/)).toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByRole('button', { name: 'desfazer' }));
    expect(await screen.findByText(/Desfazer \(Ctrl\+Z\)/)).toBeInTheDocument();
  });
});
