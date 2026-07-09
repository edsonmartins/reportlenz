package dev.reportlenz.render.pipeline;

import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import org.springframework.stereotype.Component;

import dev.reportlenz.render.pipeline.ErroDeRender.FalhaDeRender;
import net.sf.jasperreports.engine.JRDataSource;
import net.sf.jasperreports.engine.JRParameter;
import net.sf.jasperreports.engine.JasperExportManager;
import net.sf.jasperreports.engine.JasperFillManager;
import net.sf.jasperreports.engine.JasperPrint;
import net.sf.jasperreports.engine.JasperReport;
import net.sf.jasperreports.engine.data.JRMapCollectionDataSource;

/**
 * Pipeline de render em modo Push (RFC-003 §3): compile (com gate anti-Pull)
 * → montagem do datasource a partir do PAYLOAD → fill → export PDF.
 *
 * Contrato do payload (RFC-002): um objeto JSON já filtrado a montante (I-2).
 * - `$F{...}` resolve pelas chaves do payload (o registro-mestre é o próprio
 *   payload; nomes pontuados como `pedido.numero` são chaves literais);
 * - campos-coleção (List de objetos) alimentam tabelas/subreports via
 *   `JRBeanCollectionDataSource($F{campo})` emitido pelo jrxml-core;
 * - `$P{...}` recebe as entradas do payload cujo nome casa com parâmetro
 *   declarado no template.
 *
 * A validação do payload contra o inputSchema (422) entra nas tarefas 4.x,
 * ANTES deste pipeline (RFC-003 §3 passo 2).
 */
@Component
public class PipelineDeRender {

    /** Locale default do produto — formatação R$, dd/MM/yyyy (pt-BR). */
    private static final Locale PT_BR = Locale.of("pt", "BR");

    private final CompiladorJrxml compilador;

    public PipelineDeRender(CompiladorJrxml compilador) {
        this.compilador = compilador;
    }

    /** Renderiza um JRXML com o payload Push, retornando os bytes do PDF. */
    public byte[] renderizarPdf(String jrxml, Map<String, Object> payload) {
        JasperReport report = compilador.compilar(jrxml);
        Map<String, Object> parametros = parametrosDeclarados(report, payload);
        JRDataSource datasource = new JRMapCollectionDataSource(List.of(payload));

        try {
            JasperPrint print = JasperFillManager.fillReport(report, parametros, datasource);
            return JasperExportManager.exportReportToPdf(print);
        } catch (Exception e) {
            throw new FalhaDeRender("falha no fill/export: " + e.getMessage(), e);
        }
    }

    /**
     * Projeta do payload apenas os parâmetros DECLARADOS no template
     * (nunca chaves arbitrárias) e fixa o locale pt-BR do produto.
     */
    private Map<String, Object> parametrosDeclarados(JasperReport report, Map<String, Object> payload) {
        Map<String, Object> parametros = new HashMap<>();
        for (JRParameter p : report.getParameters()) {
            if (!p.isSystemDefined() && payload.containsKey(p.getName())) {
                parametros.put(p.getName(), payload.get(p.getName()));
            }
        }
        parametros.put(JRParameter.REPORT_LOCALE, PT_BR);
        return parametros;
    }
}
