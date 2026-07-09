package dev.reportlenz.render;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.assertj.core.api.Assertions.assertThat;

import java.io.ByteArrayInputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.font.PDFont;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;

import net.sf.jasperreports.engine.JREmptyDataSource;
import net.sf.jasperreports.engine.JRParameter;
import net.sf.jasperreports.engine.JasperCompileManager;
import net.sf.jasperreports.engine.JasperExportManager;
import net.sf.jasperreports.engine.JasperFillManager;
import net.sf.jasperreports.engine.JasperPrint;
import net.sf.jasperreports.engine.JasperReport;
import net.sf.jasperreports.engine.design.JasperDesign;
import net.sf.jasperreports.engine.xml.JRXmlLoader;

/**
 * Tarefa phase-1/1.2: prova que o PDF sai com acentuação pt-BR correta
 * (R$, ç, ã) usando a fonte DejaVu embarcada (jasperreports-fonts). A
 * verificação extrai o TEXTO do PDF gerado (PDFBox) — não confia no input —
 * e confere que a fonte DejaVu foi de fato embarcada no documento.
 */
class AcentuacaoPtBrTest {

    private static final String JRXML_ACENTUACAO = """
            <?xml version="1.0" encoding="UTF-8"?>
            <jasperReport name="acentuacao_ptbr" pageWidth="595" pageHeight="842" columnWidth="555" \
            leftMargin="20" rightMargin="20" topMargin="30" bottomMargin="30">
            \t<title height="80">
            \t\t<element kind="staticText" x="0" y="0" width="555" height="20">
            \t\t\t<text><![CDATA[Ação de coração: pães, maçã, açúcar, ÀÉÍÓÚ àéíóú ç Ç ã õ]]></text>
            \t\t</element>
            \t\t<element kind="textField" x="0" y="24" width="555" height="20" pattern="¤ #,##0.00">
            \t\t\t<expression><![CDATA[new java.math.BigDecimal("1234.56")]]></expression>
            \t\t</element>
            \t\t<element kind="textField" x="0" y="48" width="555" height="20">
            \t\t\t<expression><![CDATA["Situação: código nº 42 — emissão automática"]]></expression>
            \t\t</element>
            \t</title>
            </jasperReport>
            """;

    @Test
    void pdfSaiComAcentuacaoPtBrEFonteDejaVuEmbarcada() throws Exception {
        JasperDesign design = JRXmlLoader.load(new ByteArrayInputStream(JRXML_ACENTUACAO.getBytes(UTF_8)));
        JasperReport report = JasperCompileManager.compileReport(design);

        Map<String, Object> params = new HashMap<>();
        params.put(JRParameter.REPORT_LOCALE, Locale.of("pt", "BR"));
        JasperPrint print = JasperFillManager.fillReport(report, params, new JREmptyDataSource(1));
        byte[] pdf = JasperExportManager.exportReportToPdf(print);

        try (PDDocument doc = Loader.loadPDF(pdf)) {
            String texto = new PDFTextStripper().getText(doc);

            // Glifos pt-BR extraídos do PDF real (não do input)
            assertThat(texto).contains("Ação de coração");
            assertThat(texto).contains("pães, maçã, açúcar");
            assertThat(texto).contains("ÀÉÍÓÚ àéíóú ç Ç ã õ");
            assertThat(texto).contains("Situação: código nº 42 — emissão automática");

            // Moeda formatada com o locale pt-BR (¤ → R$)
            assertThat(texto).contains("R$");
            assertThat(texto).contains("1.234,56");

            // Fonte DejaVu (default do serviço, jasperreports.properties) embarcada no PDF
            List<String> fontes = new ArrayList<>();
            for (PDPage page : doc.getPages()) {
                for (var fontName : page.getResources().getFontNames()) {
                    PDFont font = page.getResources().getFont(fontName);
                    if (font != null) {
                        fontes.add(font.getName() + (font.isEmbedded() ? " [embedded]" : " [not embedded]"));
                    }
                }
            }
            assertThat(fontes).isNotEmpty();
            assertThat(fontes).anyMatch(f -> f.contains("DejaVu") && f.contains("[embedded]"));
        }
    }
}
