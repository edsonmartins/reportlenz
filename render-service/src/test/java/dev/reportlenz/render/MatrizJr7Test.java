package dev.reportlenz.render;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;

import java.io.ByteArrayInputStream;
import java.util.HashMap;

import org.junit.jupiter.api.Test;

import net.sf.jasperreports.engine.JREmptyDataSource;
import net.sf.jasperreports.engine.JasperCompileManager;
import net.sf.jasperreports.engine.JasperExportManager;
import net.sf.jasperreports.engine.JasperFillManager;
import net.sf.jasperreports.engine.JasperPrint;
import net.sf.jasperreports.engine.JasperReport;
import net.sf.jasperreports.engine.design.JasperDesign;
import net.sf.jasperreports.engine.xml.JRXmlLoader;

/**
 * Valida a matriz Maven do ADR-007 de ponta a ponta (tarefa phase-1/1.1):
 * load (core/Jackson) → compile (exige jasperreports-jdt) → fill →
 * export PDF (exige jasperreports-pdf). Se qualquer artefato da matriz
 * faltar, este teste quebra — é o guardião da modularização do JR7.
 */
class MatrizJr7Test {

    private static final String JRXML_MINIMO = """
            <?xml version="1.0" encoding="UTF-8"?>
            <jasperReport name="smoke_matriz" pageWidth="595" pageHeight="842" columnWidth="555" \
            leftMargin="20" rightMargin="20" topMargin="30" bottomMargin="30">
            \t<title height="40">
            \t\t<element kind="textField" x="0" y="0" width="555" height="20">
            \t\t\t<expression><![CDATA["matriz ok: " + String.valueOf(1 + 1)]]></expression>
            \t\t</element>
            \t</title>
            </jasperReport>
            """;

    @Test
    void compilaPreencheEExportaPdf() throws Exception {
        JasperDesign design = JRXmlLoader.load(new ByteArrayInputStream(JRXML_MINIMO.getBytes(UTF_8)));
        JasperReport report = JasperCompileManager.compileReport(design);
        // O fill MUTA o mapa de parâmetros (registra o datasource) — precisa ser mutável.
        JasperPrint print = JasperFillManager.fillReport(report, new HashMap<>(), new JREmptyDataSource(1));
        byte[] pdf = JasperExportManager.exportReportToPdf(print);

        assertThat(pdf).isNotEmpty();
        assertThat(new String(pdf, 0, 4, UTF_8)).isEqualTo("%PDF");
    }
}
