package dev.reportlenz.render.pipeline;

import static java.nio.charset.StandardCharsets.UTF_8;

import java.io.ByteArrayInputStream;

import org.springframework.stereotype.Component;

import dev.reportlenz.render.pipeline.ErroDeRender.JrxmlInvalido;
import dev.reportlenz.render.pipeline.ErroDeRender.PullProibido;
import net.sf.jasperreports.engine.JRDataset;
import net.sf.jasperreports.engine.JRException;
import net.sf.jasperreports.engine.JasperCompileManager;
import net.sf.jasperreports.engine.JasperReport;
import net.sf.jasperreports.engine.design.JasperDesign;
import net.sf.jasperreports.engine.xml.JRXmlLoader;

/**
 * Load + gate anti-Pull + compile (RFC-003 §3, passos 3 e gate do §4).
 *
 * O gate recusa as três formas de Pull (nota de design 002): query no
 * relatório principal, query em subDataset e conexão JDBC de subreport
 * (`connectionExpression`). A tarefa 2.2 envolve este componente com o
 * compile cache por sha256(jrxml) — a compilação em si não muda.
 */
@Component
public class CompiladorJrxml {

    public JasperReport compilar(String jrxml) {
        JasperDesign design;
        try {
            design = JRXmlLoader.load(new ByteArrayInputStream(jrxml.getBytes(UTF_8)));
        } catch (JRException | RuntimeException e) {
            // O load Jackson do JR7 lança JacksonRuntimeException (unchecked) para
            // estrutura desconhecida — tratar como JRXML inválido, não como bug nosso.
            throw new JrxmlInvalido("JRXML não aceito pela Library 7.0.7 (dialeto 7 exigido): " + resumo(e), e);
        }

        verificarAntiPull(design, jrxml);

        try {
            return JasperCompileManager.compileReport(design);
        } catch (JRException | RuntimeException e) {
            throw new JrxmlInvalido("JRXML não compila: " + resumo(e), e);
        }
    }

    private void verificarAntiPull(JasperDesign design, String jrxmlBruto) {
        if (temQuery(design.getMainDesignDataset())) {
            throw new PullProibido("CONTRACT_PULL_FORBIDDEN: o template embute <query> — "
                    + "ReportLenz é contract-first/Push (ADR-003); declare o contrato em <field>/<parameter>");
        }
        for (JRDataset dataset : design.getDatasetsList()) {
            if (dataset.getQuery() != null) {
                throw new PullProibido("CONTRACT_PULL_FORBIDDEN: o dataset \"" + dataset.getName()
                        + "\" embute <query> — Pull é proibido (ADR-003)");
            }
        }
        // Conexão JDBC repassada a subreport: marcador textual é suficiente e barato
        // (o elemento só existe para Pull; falso positivo exigiria CDATA forjado).
        if (jrxmlBruto.contains("<connectionExpression")) {
            throw new PullProibido("CONTRACT_PULL_FORBIDDEN: subreport com <connectionExpression> (JDBC) — "
                    + "use <dataSourceExpression> sobre campo-coleção do contrato (ADR-003)");
        }
    }

    private boolean temQuery(JRDataset datasetPrincipal) {
        return datasetPrincipal != null && datasetPrincipal.getQuery() != null;
    }

    private String resumo(Throwable e) {
        Throwable raiz = e;
        while (raiz.getCause() != null && raiz.getCause() != raiz) {
            raiz = raiz.getCause();
        }
        return raiz.getMessage();
    }
}
