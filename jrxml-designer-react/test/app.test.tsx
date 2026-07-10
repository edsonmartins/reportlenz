import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/App';
import { useDocumentoStore } from '../src/store/documentoStore';

function renderApp() {
  return render(
    <MantineProvider>
      <App />
    </MantineProvider>,
  );
}

describe('jrxml-designer-react · App shell (1.1)', () => {
  beforeEach(() => {
    useDocumentoStore.getState().fecharDocumento();
  });

  it('sem documento: oferece os templates de referência do core', () => {
    renderApp();
    expect(screen.getByText('Novo template')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'fatura' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'comprovante' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'etiqueta_a4' })).toBeInTheDocument();
  });

  it('abrir um template de referência mostra o documento no shell', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'comprovante' }));
    expect(screen.getAllByText('comprovante_entrega').length).toBeGreaterThan(0);
    expect(screen.getByText(/campos/)).toBeInTheDocument();
  });
});
