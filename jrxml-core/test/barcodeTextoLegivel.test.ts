import { describe, expect, it } from 'vitest';
import type { BarcodeElement, BarcodeType } from '../src/model/elements.js';
import { BARCODES_LINEARES } from '../src/model/elements.js';
import type { ReportTemplate } from '../src/model/report.js';
import { parseJrxml } from '../src/parse/parseJrxml.js';
import { avaliarGates } from '../src/publish/gates.js';
import { serializeJrxml } from '../src/serialize/serializeJrxml.js';
import { validateSchema } from '../src/validate/validateSchema.js';

/** Change barcode-texto-legivel (ADR-023): `textPosition` nos códigos lineares. */

function jrxmlCom(kind: string, atributos = ''): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<jasperReport name="tp" pageWidth="595" pageHeight="842" columnWidth="555" leftMargin="20" rightMargin="20" topMargin="30" bottomMargin="30">
	<parameter name="codigo" class="java.lang.String"/>
	<title height="60">
		<element kind="component" x="0" y="0" width="300" height="40">
			<component kind="barcode4j:${kind}"${atributos}>
				<codeExpression><![CDATA[$P{codigo}]]></codeExpression>
			</component>
		</element>
	</title>
</jasperReport>
`;
}

function barcodeDe(xml: string): BarcodeElement {
  const r = parseJrxml(xml);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.value.bands.title!.elements[0] as BarcodeElement;
}

function templateCom(barcodeType: BarcodeType, textPosition?: BarcodeElement['textPosition']): ReportTemplate {
  const r = parseJrxml(jrxmlCom(barcodeType));
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  const el = r.value.bands.title!.elements[0] as BarcodeElement;
  if (textPosition) el.textPosition = textPosition;
  return r.value;
}

describe('jrxml-core · texto legível do código de barras (ADR-023)', () => {
  it('Scenario "Round-trip": textPosition="none" é lido e reescrito no <component>', () => {
    const el = barcodeDe(jrxmlCom('Code128', ' textPosition="none"'));
    expect(el.textPosition).toBe('none');
    const xml = serializeJrxml(templateCom('Code128', 'none'));
    expect(xml).toContain('<component kind="barcode4j:Code128" textPosition="none">');
    expect(barcodeDe(xml).textPosition).toBe('none');
  });

  it('sem o atributo, o modelo não ganha textPosition e o XML continua sem ele', () => {
    const el = barcodeDe(jrxmlCom('Interleaved2Of5'));
    expect('textPosition' in el).toBe(false);
    expect(serializeJrxml(templateCom('Interleaved2Of5'))).not.toContain('textPosition');
  });

  it.each(['top', 'bottom'] as const)('aceita textPosition="%s" em todo código linear', (posicao) => {
    for (const tipo of BARCODES_LINEARES) {
      expect(barcodeDe(jrxmlCom(tipo, ` textPosition="${posicao}"`)).textPosition).toBe(posicao);
    }
  });

  it.each(['QRCode', 'DataMatrix', 'PDF417'])('Scenario "Código 2D": %s com textPosition → INVALID_ATTRIBUTE', (tipo) => {
    const r = validateSchema(jrxmlCom(tipo, ' textPosition="none"'));
    expect(r.valid).toBe(false);
    expect(r.messages[0]?.code).toBe('INVALID_ATTRIBUTE');
    expect(r.messages[0]?.message).toContain('só vale para códigos lineares');
  });

  it('valor fora de none/bottom/top → INVALID_ATTRIBUTE', () => {
    const r = validateSchema(jrxmlCom('Code128', ' textPosition="left"'));
    expect(r.valid).toBe(false);
    expect(r.messages[0]?.message).toContain('textPosition inválido');
  });

  it('modelo montado no designer com textPosition num QR reprova o G1 (aproximação estrutural)', () => {
    const t = templateCom('QRCode');
    (t.bands.title!.elements[0] as BarcodeElement).textPosition = 'none';
    const g1 = avaliarGates(t).gates.find((g) => g.gate === 'G1')!;
    expect(g1.verde).toBe(false);
  });
});
