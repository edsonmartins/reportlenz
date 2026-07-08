import { describe, expect, it } from 'vitest';
import { parseJrxml } from '../src/index.js';

/**
 * Testes da tarefa phase-0/4.1c: component (table, barcode) e subreport,
 * no formato do dialeto 7 (nota de design 002).
 */

const ETIQUETA_BARCODE = `<?xml version="1.0" encoding="UTF-8"?>
<jasperReport name="etiqueta_a4" pageWidth="595" pageHeight="842" columnCount="3" columnWidth="178" columnSpacing="10">
	<field name="produto_nome" class="java.lang.String"/>
	<field name="ean" class="java.lang.String"/>
	<detail>
		<band height="80" splitType="Prevent">
			<element kind="textField" x="0" y="0" width="178" height="16">
				<expression><![CDATA[$F{produto_nome}]]></expression>
			</element>
			<element kind="component" x="0" y="20" width="178" height="50">
				<component kind="barcode4j:EAN13">
					<codeExpression><![CDATA[$F{ean}]]></codeExpression>
				</component>
			</element>
		</band>
	</detail>
</jasperReport>`;

const COMPROVANTE_TABELA = `<?xml version="1.0" encoding="UTF-8"?>
<jasperReport name="comprovante" pageWidth="595" pageHeight="842" columnWidth="555">
	<dataset name="itens_ds">
		<field name="descricao" class="java.lang.String"/>
		<field name="quantidade" class="java.lang.Integer"/>
	</dataset>
	<field name="itens" class="java.util.List"/>
	<detail>
		<band height="120">
			<element kind="component" x="0" y="0" width="555" height="100" style="Tabela">
				<component kind="table">
					<datasetRun subDataset="itens_ds">
						<dataSourceExpression><![CDATA[new net.sf.jasperreports.engine.data.JRBeanCollectionDataSource($F{itens})]]></dataSourceExpression>
					</datasetRun>
					<column kind="single" width="355">
						<columnHeader height="20" style="CabecalhoTabela">
							<element kind="staticText" x="0" y="0" width="355" height="20">
								<text><![CDATA[Descrição]]></text>
							</element>
						</columnHeader>
						<detailCell height="16">
							<element kind="textField" x="0" y="0" width="355" height="16">
								<expression><![CDATA[$F{descricao}]]></expression>
							</element>
						</detailCell>
					</column>
					<column kind="single" width="200">
						<detailCell height="16">
							<element kind="textField" x="0" y="0" width="200" height="16" hTextAlign="Right">
								<expression><![CDATA[$F{quantidade}]]></expression>
							</element>
						</detailCell>
						<columnFooter height="18">
							<element kind="staticText" x="0" y="0" width="200" height="18">
								<text><![CDATA[Total]]></text>
							</element>
						</columnFooter>
					</column>
				</component>
			</element>
		</band>
	</detail>
</jasperReport>`;

const MASTER_SUBREPORT = `<?xml version="1.0" encoding="UTF-8"?>
<jasperReport name="master" pageWidth="595" pageHeight="842" columnWidth="555">
	<parameter name="sub_template" class="java.lang.String"/>
	<field name="cidade" class="java.lang.String"/>
	<field name="entregas" class="java.util.List"/>
	<detail>
		<band height="40">
			<element kind="subreport" x="0" y="0" width="555" height="30">
				<expression><![CDATA[$P{sub_template}]]></expression>
				<dataSourceExpression><![CDATA[new net.sf.jasperreports.engine.data.JRBeanCollectionDataSource($F{entregas})]]></dataSourceExpression>
				<parameter name="cidade">
					<expression><![CDATA[$F{cidade}]]></expression>
				</parameter>
			</element>
		</band>
	</detail>
</jasperReport>`;

describe('jrxml-core · parseJrxml — componentes (4.1c)', () => {
  it('mapeia barcode4j:EAN13 para BarcodeElement', () => {
    const result = parseJrxml(ETIQUETA_BARCODE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const barcode = result.value.bands.detail[0]?.elements[1];
    expect(barcode?.kind).toBe('barcode');
    if (barcode?.kind !== 'barcode') return;
    expect(barcode.barcodeType).toBe('EAN13');
    expect(barcode.expression).toBe('$F{ean}');
    expect(barcode.bounds).toEqual({ x: 0, y: 20, width: 178, height: 50 });
  });

  it('mapeia component table para TableElement e liga itemFields via dataset', () => {
    const result = parseJrxml(COMPROVANTE_TABELA);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const t = result.value;

    const tabela = t.bands.detail[0]?.elements[0];
    expect(tabela?.kind).toBe('table');
    if (tabela?.kind !== 'table') return;

    // Push: alimentada pelo campo-coleção do contrato
    expect(tabela.datasetField).toBe('itens');
    expect(tabela.styleRef).toBe('Tabela');

    // Colunas com células
    expect(tabela.columns).toHaveLength(2);
    expect(tabela.columns[0]?.width).toBe(355);
    expect(tabela.columns[0]?.header?.styleRef).toBe('CabecalhoTabela');
    expect(tabela.columns[0]?.header?.elements[0]?.kind).toBe('staticText');
    expect(tabela.columns[0]?.detail.elements[0]?.kind).toBe('textField');
    expect(tabela.columns[0]?.footer).toBeUndefined();
    expect(tabela.columns[1]?.footer?.height).toBe(18);

    // Contrato: dataset ligou os itemFields da coleção
    const itens = t.dataContract.fields.find((f) => f.name === 'itens');
    expect(itens?.type).toBe('collection');
    expect(itens?.itemFields?.map((f) => `${f.name}:${f.type}`)).toEqual(['descricao:string', 'quantidade:integer']);
  });

  it('mapeia subreport Push (template + datasource + parâmetros)', () => {
    const result = parseJrxml(MASTER_SUBREPORT);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const sub = result.value.bands.detail[0]?.elements[0];
    expect(sub?.kind).toBe('subreport');
    if (sub?.kind !== 'subreport') return;
    expect(sub.templateExpression).toBe('$P{sub_template}');
    expect(sub.dataSourceExpression).toContain('$F{entregas}');
    expect(sub.parameters).toEqual([{ name: 'cidade', expression: '$F{cidade}' }]);
  });

  it('rejeita tabela cujo dataSourceExpression não referencia campo do contrato (Push)', () => {
    const xml = COMPROVANTE_TABELA.replace(
      'new net.sf.jasperreports.engine.data.JRBeanCollectionDataSource($F{itens})',
      'new JREmptyDataSource(50)',
    );
    const result = parseJrxml(xml);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const e = result.errors[0];
    expect(e?.code).toBe('INVALID_ATTRIBUTE');
    expect(e?.message).toContain('Push');
    expect(e?.path).toContain('datasetRun');
  });

  it('rejeita datasetRun para dataset inexistente', () => {
    const xml = COMPROVANTE_TABELA.replace('subDataset="itens_ds">', 'subDataset="nao_existe">');
    const result = parseJrxml(xml);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]?.message).toContain('nao_existe');
  });

  it('acusa UNSUPPORTED_ELEMENT para barcode fora do subconjunto', () => {
    const xml = ETIQUETA_BARCODE.replace('barcode4j:EAN13', 'barcode4j:POSTNET');
    const result = parseJrxml(xml);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]?.code).toBe('UNSUPPORTED_ELEMENT');
    expect(result.errors[0]?.message).toContain('POSTNET');
  });

  it('acusa UNSUPPORTED_ELEMENT para coluna de grupo (Fase 3)', () => {
    const xml = COMPROVANTE_TABELA.replace('<column kind="single" width="355">', '<column kind="group" width="355">');
    const result = parseJrxml(xml);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const e = result.errors.find((x) => x.code === 'UNSUPPORTED_ELEMENT');
    expect(e?.message).toContain('group');
  });
});
