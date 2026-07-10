import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen, within } from '@testing-library/react';
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

  it('sem documento: mostra a galeria de modelos pt-BR', () => {
    renderApp();
    expect(screen.getByText('Novo template')).toBeInTheDocument();
    expect(screen.getByTestId('galeria')).toBeInTheDocument();
    expect(screen.getByTestId('modelo-fatura')).toBeInTheDocument();
  });

  it('abrir um template da galeria mostra o documento no canvas', () => {
    renderApp();
    const card = screen.getByTestId('modelo-comprovante');
    fireEvent.click(within(card).getByRole('button', { name: 'Usar' }));
    expect(screen.getAllByText('comprovante_entrega').length).toBeGreaterThan(0);
    expect(screen.getByTestId('pagina-canvas')).toBeInTheDocument();
    expect(screen.getByText('ok')).toBeInTheDocument(); // badge de problemas zerado
  });
});
