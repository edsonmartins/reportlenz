import { describe, expect, it } from 'vitest';
import { parseJrxml } from '../src/index.js';

/**
 * Testes das tarefas phase-0/4.2 (LEGACY_DIALECT) e 4.3 (CONTRACT_PULL_FORBIDDEN).
 * Cenários do spec: 'JRXML de dialeto 6.x' e 'JRXML com queryString'.
 */

describe('jrxml-core · anti-Pull (4.3, ADR-003)', () => {
  it('rejeita <query language="sql"> (forma Pull do dialeto 7) com CONTRACT_PULL_FORBIDDEN', () => {
    const xml = `<jasperReport name="x">
      <parameter name="max" class="java.lang.Integer"/>
      <query language="sql"><![CDATA[SELECT * FROM pedidos WHERE id <= $P{max}]]></query>
      <field name="numero" class="java.lang.String"/>
    </jasperReport>`;
    const result = parseJrxml(xml);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.code).toBe('CONTRACT_PULL_FORBIDDEN');
    expect(result.errors[0]?.path).toBe('jasperReport/query');
    expect(result.errors[0]?.message).toContain('Push');
  });

  it('rejeita <query> dentro de <dataset> (Pull escondido no subDataset)', () => {
    const xml = `<jasperReport name="x">
      <dataset name="itens_ds">
        <query language="sql"><![CDATA[SELECT * FROM itens]]></query>
        <field name="descricao" class="java.lang.String"/>
      </dataset>
    </jasperReport>`;
    const result = parseJrxml(xml);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]?.code).toBe('CONTRACT_PULL_FORBIDDEN');
    expect(result.errors[0]?.path).toBe('jasperReport/dataset/query');
  });

  it('rejeita <connectionExpression> em subreport (JDBC) com CONTRACT_PULL_FORBIDDEN', () => {
    const xml = `<jasperReport name="x">
      <detail><band height="30">
        <element kind="subreport" x="0" y="0" width="100" height="20">
          <connectionExpression><![CDATA[$P{REPORT_CONNECTION}]]></connectionExpression>
          <expression><![CDATA["Sub.jasper"]]></expression>
        </element>
      </band></detail>
    </jasperReport>`;
    const result = parseJrxml(xml);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]?.code).toBe('CONTRACT_PULL_FORBIDDEN');
    expect(result.errors[0]?.message).toContain('dataSourceExpression');
  });

  it('cenário do spec: <queryString> retorna CONTRACT_PULL_FORBIDDEN e template inválido', () => {
    const xml = `<jasperReport name="x">
      <queryString><![CDATA[SELECT 1]]></queryString>
    </jasperReport>`;
    const result = parseJrxml(xml);
    expect(result.ok).toBe(false); // não é válido para save/publish
    if (result.ok) return;
    expect(result.errors.some((e) => e.code === 'CONTRACT_PULL_FORBIDDEN')).toBe(true);
  });
});

describe('jrxml-core · dialeto legado (4.2, ADR-002)', () => {
  // Documento no formato 6.x típico (como o fork emite): namespace + reportElement.
  const JRXML_6X = `<?xml version="1.0" encoding="UTF-8"?>
<jasperReport xmlns="http://jasperreports.sourceforge.net/jasperreports"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://jasperreports.sourceforge.net/jasperreports http://jasperreports.sourceforge.net/xsd/jasperreport.xsd"
  name="relatorio6" pageWidth="595" pageHeight="842">
  <field name="nome" class="java.lang.String"/>
  <detail>
    <band height="20">
      <staticText>
        <reportElement x="0" y="0" width="100" height="20"/>
        <text><![CDATA[Nome:]]></text>
      </staticText>
    </band>
  </detail>
</jasperReport>`;

  it('cenário do spec: JRXML 6.x retorna LEGACY_DIALECT sem produzir modelo', () => {
    const result = parseJrxml(JRXML_6X);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const legacy = result.errors.filter((e) => e.code === 'LEGACY_DIALECT');
    expect(legacy.length).toBeGreaterThan(0);
    // Aponta tanto o namespace na raiz quanto o <reportElement> aninhado
    expect(legacy.some((e) => e.path === 'jasperReport' && e.message.includes('namespace'))).toBe(true);
    expect(legacy.some((e) => e.path.endsWith('/reportElement'))).toBe(true);
    // Recusa decisiva: nenhum ruído de erros de parse fino
    expect(result.errors.every((e) => e.code === 'LEGACY_DIALECT' || e.code === 'CONTRACT_PULL_FORBIDDEN')).toBe(true);
  });

  it('detecta <variableExpression> e <groupExpression> (6.x) mesmo sem namespace', () => {
    const xml = `<jasperReport name="x">
      <variable name="total" class="java.lang.Double" calculation="Sum">
        <variableExpression><![CDATA[$F{valor}]]></variableExpression>
      </variable>
      <group name="g">
        <groupExpression><![CDATA[$F{categoria}]]></groupExpression>
      </group>
    </jasperReport>`;
    const result = parseJrxml(xml);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const paths = result.errors.map((e) => e.path);
    expect(result.errors.every((e) => e.code === 'LEGACY_DIALECT')).toBe(true);
    expect(paths).toContain('jasperReport/variable/variableExpression');
    expect(paths).toContain('jasperReport/group/groupExpression');
  });

  it('6.x com queryString acusa Pull E legado juntos', () => {
    const xml = JRXML_6X.replace(
      '<field name="nome" class="java.lang.String"/>',
      '<queryString><![CDATA[SELECT nome FROM clientes]]></queryString><field name="nome" class="java.lang.String"/>',
    );
    const result = parseJrxml(xml);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const codes = new Set(result.errors.map((e) => e.code));
    expect(codes.has('CONTRACT_PULL_FORBIDDEN')).toBe(true);
    expect(codes.has('LEGACY_DIALECT')).toBe(true);
  });
});
