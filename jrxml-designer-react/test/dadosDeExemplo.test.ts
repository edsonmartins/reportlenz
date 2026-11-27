import { REFERENCIA_ETIQUETA_A4, extractContract } from '@archbase/reportlenz-jrxml-core';
import { describe, expect, it } from 'vitest';
import {
  camposDeCodigoDeBarras,
  digitoVerificadorEan,
  gerarDadosDeExemplo,
  valorDeCodigoDeBarras,
} from '../src/preview/dadosDeExemplo';

/**
 * Dados de exemplo × códigos de barras: o preview da etiqueta A4 (EAN13)
 * falhava com "Invalid characters found. Valid are 0-9 only. Message: ean
 * exemplo". Campos que alimentam barcode recebem valor válido p/ a simbologia.
 */
describe('jrxml-designer-react · dados de exemplo para códigos de barras', () => {
  it('dígito verificador GS1 confere com códigos reais', () => {
    expect(digitoVerificadorEan('789100031550')).toBe('7'); // 7891000315507
    expect(digitoVerificadorEan('400638133393')).toBe('1'); // 4006381333931
    expect(digitoVerificadorEan('9638507')).toBe('4'); // EAN-8 96385074
  });

  it('EAN13/EAN8/I2of5/Code39 geram valores válidos e variam por item', () => {
    const ean13 = [0, 1, 2].map((i) => valorDeCodigoDeBarras('EAN13', 'ean', i));
    for (const v of ean13) {
      expect(v).toMatch(/^\d{13}$/);
      expect(digitoVerificadorEan(v.slice(0, 12))).toBe(v[12]);
    }
    expect(new Set(ean13).size).toBe(3);

    const ean8 = valorDeCodigoDeBarras('EAN8', 'ean', 0);
    expect(ean8).toMatch(/^\d{8}$/);
    expect(digitoVerificadorEan(ean8.slice(0, 7))).toBe(ean8[7]);

    const i2of5 = valorDeCodigoDeBarras('Interleaved2Of5', 'boleto', 4);
    expect(i2of5).toMatch(/^\d+$/);
    expect(i2of5.length % 2).toBe(0);

    expect(valorDeCodigoDeBarras('Code39', 'cód.item', 0)).toMatch(/^[A-Z0-9 .$/+%-]+$/);
    expect(valorDeCodigoDeBarras('QRCode', 'qr', 0)).toBe('qr exemplo');
  });

  it('etiqueta A4 de referência: $F{ean} (dentro da coleção) vira EAN13 válido nos 9 itens da grade', () => {
    const codigos = camposDeCodigoDeBarras(REFERENCIA_ETIQUETA_A4);
    expect(codigos).toMatchObject({ ean: 'EAN13' });

    const payload = gerarDadosDeExemplo(extractContract(REFERENCIA_ETIQUETA_A4), {
      datasourceCampo: 'etiquetas',
      codigosDeBarras: codigos,
    });
    const etiquetas = payload.etiquetas as Array<Record<string, unknown>>;
    expect(etiquetas).toHaveLength(9);
    for (const e of etiquetas) {
      expect(e.ean).toMatch(/^789\d{10}$/);
      expect(e.produto_nome).toMatch(/exemplo/); // demais strings seguem o texto de amostra
    }
  });

  it('expressão composta não é tratada como conteúdo direto do campo', () => {
    const template = { bands: [{ elements: [{ kind: 'barcode', barcodeType: 'EAN13', expression: '"789" + $F{codigo}' }] }] };
    expect(camposDeCodigoDeBarras(template)).toEqual({});
  });
});
