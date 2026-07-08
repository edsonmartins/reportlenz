import { describe, expect, it } from 'vitest';
import { parseJrxml } from '../src/index.js';

/**
 * Testes do parser (phase-0/4.1a/4.1b) contra o dialeto 7 real (nota de
 * design 002): raiz sem namespace, <element kind>, contrato declarado.
 * Fixture Push: sem <query> — o contrato declara o que o payload fornece.
 */
const FATURA_JRXML7 = `<?xml version="1.0" encoding="UTF-8"?>
<jasperReport name="fatura" pageWidth="595" pageHeight="842" columnWidth="555" leftMargin="20" rightMargin="20" topMargin="20" bottomMargin="20">
	<property name="reportlenz.template.tipo" value="fatura"/>
	<style name="titulo" fontName="DejaVu Sans" fontSize="16.0" bold="true"/>
	<style name="linha_zebrada" mode="Transparent">
		<conditionalStyle mode="Opaque" backcolor="#F0EFEF">
			<conditionExpression><![CDATA[$V{REPORT_COUNT}%2 == 0]]></conditionExpression>
		</conditionalStyle>
	</style>
	<parameter name="logo_url" class="java.lang.String"/>
	<parameter name="titulo_relatorio" class="java.lang.String">
		<defaultValueExpression><![CDATA["Fatura"]]></defaultValueExpression>
	</parameter>
	<field name="categoria" class="java.lang.String"/>
	<field name="descricao" class="java.lang.String">
		<description><![CDATA[Descrição do item]]></description>
	</field>
	<field name="valor" class="java.math.BigDecimal"/>
	<variable name="total_geral" class="java.math.BigDecimal" calculation="Sum" resetType="Report">
		<expression><![CDATA[$F{valor}]]></expression>
	</variable>
	<group name="por_categoria">
		<expression><![CDATA[$F{categoria}]]></expression>
		<groupHeader>
			<band height="20">
				<element kind="textField" x="0" y="0" width="200" height="16" bold="true">
					<expression><![CDATA[$F{categoria}]]></expression>
				</element>
			</band>
		</groupHeader>
	</group>
	<title>
		<band height="60" splitType="Stretch">
			<element kind="textField" x="0" y="0" width="300" height="30" style="titulo">
				<expression><![CDATA[$P{titulo_relatorio}]]></expression>
			</element>
			<element kind="image" x="455" y="0" width="100" height="50" scaleImage="RetainShape">
				<expression><![CDATA[$P{logo_url}]]></expression>
			</element>
			<element kind="line" x="0" y="55" width="555" height="1">
				<pen lineWidth="0.5" lineColor="#000000"/>
			</element>
		</band>
	</title>
	<detail>
		<band height="18">
			<element kind="textField" x="0" y="0" width="355" height="16" style="linha_zebrada">
				<expression><![CDATA[$F{descricao}]]></expression>
			</element>
			<element kind="textField" x="355" y="0" width="200" height="16" pattern="¤ #,##0.00" blankWhenNull="true" hTextAlign="Right">
				<expression><![CDATA[$F{valor}]]></expression>
			</element>
		</band>
	</detail>
	<summary>
		<band height="30" splitType="Prevent">
			<element kind="frame" x="300" y="0" width="255" height="24">
				<element kind="staticText" x="0" y="0" width="80" height="20">
					<text><![CDATA[Total:]]></text>
				</element>
				<element kind="textField" x="80" y="0" width="175" height="20" pattern="¤ #,##0.00">
					<expression><![CDATA[$V{total_geral}]]></expression>
				</element>
			</element>
		</band>
	</summary>
</jasperReport>
`;

describe('jrxml-core · parseJrxml (dialeto 7)', () => {
  it('converte JRXML 7 válido em ReportTemplate com bandas, estilos e contrato', () => {
    const result = parseJrxml(FATURA_JRXML7);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const t = result.value;

    // Raiz e página
    expect(t.name).toBe('fatura');
    expect(t.pageFormat.pageWidth).toBe(595);
    expect(t.pageFormat.topMargin).toBe(20);
    expect(t.pageFormat.columnCount).toBe(1); // default do engine
    expect(t.properties['reportlenz.template.tipo']).toBe('fatura');

    // Estilos (incl. conditionalStyle com atributos diretos — dialeto 7)
    expect(t.styles.map((s) => s.name)).toEqual(['titulo', 'linha_zebrada']);
    expect(t.styles[1]?.conditionalStyles?.[0]?.style.backcolor).toBe('#F0EFEF');
    expect(t.styles[1]?.conditionalStyles?.[0]?.conditionExpression).toContain('REPORT_COUNT');

    // Contrato (Scenario: popula dataContract a partir de field/parameter/variable)
    expect(t.dataContract.fields.map((f) => f.name)).toEqual(['categoria', 'descricao', 'valor']);
    expect(t.dataContract.fields[1]?.description).toBe('Descrição do item');
    expect(t.dataContract.fields[2]?.type).toBe('decimal');
    expect(t.dataContract.parameters[1]?.defaultValueExpression).toBe('"Fatura"');
    expect(t.dataContract.variables[0]).toMatchObject({
      name: 'total_geral',
      type: 'decimal',
      calculation: 'Sum',
      resetType: 'Report',
      expression: '$F{valor}',
    });

    // Bandas e elementos
    expect(t.bands.title?.height).toBe(60);
    expect(t.bands.title?.elements.map((e) => e.kind)).toEqual(['textField', 'image', 'line']);
    const linha = t.bands.title?.elements[2];
    expect(linha?.kind === 'line' && linha.pen?.lineWidth).toBe(0.5);

    expect(t.bands.detail).toHaveLength(1);
    const valorField = t.bands.detail[0]?.elements[1];
    expect(valorField?.kind === 'textField' && valorField.pattern).toBe('¤ #,##0.00');
    expect(valorField?.kind === 'textField' && valorField.style?.hAlign).toBe('Right');
    expect(valorField?.kind === 'textField' && valorField.styleRef).toBeUndefined();

    // Frame aninhado no summary
    const frame = t.bands.summary?.elements[0];
    expect(frame?.kind).toBe('frame');
    if (frame?.kind === 'frame') {
      expect(frame.elements.map((e) => e.kind)).toEqual(['staticText', 'textField']);
    }

    // Grupo
    expect(t.bands.groups[0]?.name).toBe('por_categoria');
    expect(t.bands.groups[0]?.header?.elements).toHaveLength(1);
    expect(t.bands.summary?.splitType).toBe('Prevent');
  });

  it('rejeita XML mal-formado com XML_MALFORMED', () => {
    const result = parseJrxml('<jasperReport name="x"><band></jasperReport>');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]?.code).toBe('XML_MALFORMED');
  });

  it('rejeita documento cuja raiz não é <jasperReport>', () => {
    const result = parseJrxml('<?xml version="1.0"?><relatorio name="x"/>');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]?.code).toBe('XML_MALFORMED');
    expect(result.errors[0]?.message).toContain('jasperReport');
  });

  it('acusa UNSUPPORTED_ELEMENT com caminho para kind fora do subconjunto', () => {
    const xml = `<jasperReport name="x">
      <detail><band height="20">
        <element kind="crosstab" x="0" y="0" width="100" height="20"/>
      </band></detail>
    </jasperReport>`;
    const result = parseJrxml(xml);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const e = result.errors.find((x) => x.code === 'UNSUPPORTED_ELEMENT');
    expect(e?.message).toContain('crosstab');
    expect(e?.path).toBe('jasperReport/detail/band[0]/element[0]');
  });

  it('acusa INVALID_ATTRIBUTE para atributos obrigatórios ausentes', () => {
    const xml = `<jasperReport name="x">
      <detail><band>
        <element kind="staticText" x="0" y="0" width="100"><text>oi</text></element>
      </band></detail>
    </jasperReport>`;
    const result = parseJrxml(xml);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const messages = result.errors.map((e) => e.message).join('; ');
    expect(messages).toContain('height'); // banda sem height E elemento sem height
    expect(result.errors.every((e) => e.code === 'INVALID_ATTRIBUTE')).toBe(true);
  });

  it('acusa UNSUPPORTED_TYPE para classe Java fora do mapeamento do contrato', () => {
    const xml = `<jasperReport name="x">
      <parameter name="img" class="java.awt.Image"/>
    </jasperReport>`;
    const result = parseJrxml(xml);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]?.code).toBe('UNSUPPORTED_TYPE');
    expect(result.errors[0]?.message).toContain('java.awt.Image');
    expect(result.errors[0]?.path).toBe('jasperReport/parameter[0]');
  });

  it('field com classe de coleção vira type collection (alimenta tabela)', () => {
    const xml = `<jasperReport name="x">
      <field name="itens" class="java.util.List"/>
    </jasperReport>`;
    const result = parseJrxml(xml);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.dataContract.fields[0]?.type).toBe('collection');
  });
});
