import { MantineProvider } from '@mantine/core';
import { REFERENCIA_FATURA } from '@reportlenz/jrxml-core';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/App';
import { PRESETS_DE_ELEMENTO } from '../src/palette/inserir';
import { useCanvasStore } from '../src/store/canvasStore';
import { useDocumentoStore, validarDocumento } from '../src/store/documentoStore';

/**
 * Fase 3, bloco 3 — inserção de elementos + perfis de barcode pt-BR
 * (boleto ITF-25, DANFE Code128, QR NFC-e/Pix).
 */

function renderApp() {
  return render(
    <MantineProvider>
      <App />
    </MantineProvider>,
  );
}

function inserir(rotulo: string) {
  fireEvent.click(screen.getByRole('button', { name: '+ Inserir' }));
  fireEvent.click(screen.getByRole('menuitem', { name: rotulo }));
}

describe('jrxml-designer-react · inserção e perfis de barcode (Fase 3, bloco 3)', () => {
  beforeEach(() => {
    useDocumentoStore.getState().fecharDocumento();
    useCanvasStore.setState({ zoom: 1, mostrarGrid: false, passoGridMm: 5, snapAtivo: false, guiasDeSnap: null });
    useDocumentoStore.getState().novoDocumento(structuredClone(REFERENCIA_FATURA));
  });

  it('todos os presets criam elementos que mantêm o documento válido', () => {
    const base = useDocumentoStore.getState().template!;
    for (const preset of PRESETS_DE_ELEMENTO) {
      const detail = structuredClone(base);
      detail.bands.detail[0]!.elements.push(preset.criar());
      expect(validarDocumento(detail), preset.rotulo).toEqual([]);
    }
  });

  it('perfil boleto: ITF-25 com ~103×13mm e amostra de 44 dígitos (comprimento par)', () => {
    const boleto = PRESETS_DE_ELEMENTO.find((p) => p.rotulo.includes('Boleto'))!.criar();
    if (boleto.kind !== 'barcode') throw new Error('inesperado');
    expect(boleto.barcodeType).toBe('Interleaved2Of5');
    expect(boleto.bounds.width).toBe(292); // 103mm
    expect(boleto.bounds.height).toBe(37); // 13mm
    const digitos = /"(\d+)"/.exec(boleto.expression)?.[1] ?? '';
    expect(digitos).toHaveLength(44);
    expect(digitos.length % 2).toBe(0); // ITF exige par
  });

  it('perfil DANFE: Code128 com chave de 44 dígitos; QR quadrado de 25mm', () => {
    const danfe = PRESETS_DE_ELEMENTO.find((p) => p.rotulo.includes('DANFE'))!.criar();
    if (danfe.kind !== 'barcode') throw new Error('inesperado');
    expect(danfe.barcodeType).toBe('Code128');
    expect(/"(\d{44})"/.test(danfe.expression)).toBe(true);

    const qr = PRESETS_DE_ELEMENTO.find((p) => p.rotulo.includes('QR'))!.criar();
    if (qr.kind !== 'barcode') throw new Error('inesperado');
    expect(qr.barcodeType).toBe('QRCode');
    expect(qr.bounds.width).toBe(qr.bounds.height); // quadrado
  });

  it('inserir pelo menu adiciona na banda da seleção e seleciona o novo', () => {
    renderApp();

    // Seleciona um elemento do título → a banda alvo é o título.
    const alvo = screen.getByTestId('el-title/0');
    fireEvent.pointerDown(alvo, { pointerId: 1 });
    fireEvent.pointerUp(alvo, { pointerId: 1 });

    inserir('QR Code (NFC-e/Pix)');

    const titulo = useDocumentoStore.getState().template?.bands.title;
    expect(titulo?.elements).toHaveLength(4);
    expect(titulo?.elements[3]?.kind).toBe('barcode');
    // Novo elemento nasce selecionado (pronto p/ mover/editar)
    expect(screen.getByTestId('el-title/3')).toHaveAttribute('data-selecionado');
    expect(useDocumentoStore.getState().problemas).toEqual([]);
  });

  it('sem seleção, insere na primeira banda detail; undo remove', () => {
    renderApp();
    inserir('Texto fixo');

    const detail = useDocumentoStore.getState().template?.bands.detail[0];
    expect(detail?.elements.at(-1)?.kind).toBe('staticText');

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(useDocumentoStore.getState().template?.bands.detail[0]?.elements.at(-1)?.kind).not.toBe('staticText');
  });
});
