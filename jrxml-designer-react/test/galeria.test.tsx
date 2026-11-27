import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/App';
import { REFERENCE_TEMPLATES } from '@archbase/reportlenz-jrxml-core';
import { MODELOS, criarTemplateEmBranco } from '../src/galeria/Galeria';
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

  it('catálogo ampliado (ADR-022): todo modelo do jrxml-core está na galeria, agrupado por família', () => {
    const doCatalogo = Object.entries(REFERENCE_TEMPLATES)
      .filter(([, t]) => t.properties['reportlenz.template.tipo'] !== 'subreport')
      .map(([chave]) => chave);
    expect(doCatalogo).toHaveLength(14);
    expect(MODELOS.map((m) => m.chave).sort()).toEqual(['em_branco', ...doCatalogo].sort());

    renderApp();
    for (const chave of doCatalogo) {
      expect(screen.getByTestId(`modelo-${chave}`)).toBeInTheDocument();
    }
    for (const familia of ['Fiscais e cobrança', 'Gerenciais', 'Etiquetas e crachás', 'Cartas e documentos']) {
      expect(screen.getByText(familia)).toBeInTheDocument();
    }
    expect(within(screen.getByTestId('modelo-listagem_vendas')).getByText('paisagem')).toBeInTheDocument();
    expect(within(screen.getByTestId('modelo-etiqueta_produto_qr')).getByText('4 colunas')).toBeInTheDocument();
  });

  it('todo modelo da galeria abre válido no dialeto 7 (0 problemas) e como cópia independente', () => {
    for (const m of MODELOS) {
      const t = m.criar();
      expect(validarDocumento(t), m.chave).toEqual([]);
      if (m.chave !== 'em_branco') {
        expect(t).toEqual(REFERENCE_TEMPLATES[m.chave]);
        expect(t).not.toBe(REFERENCE_TEMPLATES[m.chave]); // edição não contamina o catálogo
      }
    }
  });

  it('abrir o DANFE pela galeria leva ao editor com o contrato do modelo', () => {
    renderApp();
    fireEvent.click(within(screen.getByTestId('modelo-danfe')).getByRole('button', { name: 'Usar' }));
    expect(screen.getByTestId('pagina-canvas')).toBeInTheDocument();
    expect(useDocumentoStore.getState().template?.name).toBe('danfe_retrato');
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
