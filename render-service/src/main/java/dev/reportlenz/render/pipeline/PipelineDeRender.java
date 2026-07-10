package dev.reportlenz.render.pipeline;

import java.awt.Image;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import javax.imageio.ImageIO;

import org.springframework.stereotype.Component;

import dev.reportlenz.render.pipeline.ErroDeRender.FalhaDeRender;
import io.micrometer.observation.Observation;
import io.micrometer.observation.ObservationRegistry;
import net.sf.jasperreports.engine.JRDataSource;
import net.sf.jasperreports.engine.JRParameter;
import net.sf.jasperreports.engine.JasperExportManager;
import net.sf.jasperreports.engine.JasperFillManager;
import net.sf.jasperreports.engine.JasperPrint;
import net.sf.jasperreports.engine.JasperPrintManager;
import net.sf.jasperreports.engine.JasperReport;
import net.sf.jasperreports.engine.data.JRMapCollectionDataSource;

/**
 * Pipeline de render em modo Push (RFC-003 §3): compile com cache
 * (sha256(jrxml), ADR-008) e gate anti-Pull → montagem do datasource a partir
 * do PAYLOAD → fill → export (PDF ou PNG por página, p/ preview).
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

    /** Zoom do PNG de preview (2x ≈ 144 dpi — nítido no painel lado a lado). */
    private static final float ZOOM_PREVIEW_PNG = 2.0f;

    private final CompiladorJrxml compilador;
    private final CacheDeCompilacao cache;
    private final ObservationRegistry observacoes;

    public PipelineDeRender(CompiladorJrxml compilador, CacheDeCompilacao cache, ObservationRegistry observacoes) {
        this.compilador = compilador;
        this.cache = cache;
        this.observacoes = observacoes;
    }

    /**
     * Compila (com cache) e preenche com o payload Push. Observabilidade
     * (RFC-003 §7): spans/métricas SEPARADOS por etapa — `render.compilacao`
     * só quando compila de verdade (cache hit não conta), `render.fill` sempre.
     */
    public JasperPrint preencher(String jrxml, Map<String, Object> payload) {
        JasperReport report = cache.obterOuCompilar(jrxml, fonte ->
                Observation.createNotStarted("render.compilacao", observacoes)
                        .observe(() -> compilador.compilar(fonte)));
        Map<String, Object> registro = comChavesAchatadas(payload);
        Map<String, Object> parametros = parametrosDeclarados(report, registro);
        JRDataSource datasource = new JRMapCollectionDataSource(List.of(registro));
        try {
            return Observation.createNotStarted("render.fill", observacoes).observe(() -> {
                try {
                    return JasperFillManager.fillReport(report, parametros, datasource);
                } catch (Exception e) {
                    throw new FalhaDeRender("falha no fill: " + e.getMessage(), e);
                }
            });
        } catch (FalhaDeRender e) {
            throw e;
        } catch (Exception e) {
            throw new FalhaDeRender("falha no fill: " + e.getMessage(), e);
        }
    }

    /** Conveniência: fill + export PDF. */
    public byte[] renderizarPdf(String jrxml, Map<String, Object> payload) {
        return exportarPdf(preencher(jrxml, payload));
    }

    public byte[] exportarPdf(JasperPrint print) {
        return Observation.createNotStarted("render.export", observacoes)
                .lowCardinalityKeyValue("formato", "pdf")
                .observe(() -> {
                    try {
                        return JasperExportManager.exportReportToPdf(print);
                    } catch (Exception e) {
                        throw new FalhaDeRender("falha no export PDF: " + e.getMessage(), e);
                    }
                });
    }

    /** Exporta UMA página como PNG (preview paginado do designer, RFC-003 §4). */
    public byte[] exportarPng(JasperPrint print, int pagina) {
        int total = print.getPages().size();
        if (pagina < 0 || pagina >= total) {
            throw new FalhaDeRender("página " + pagina + " inexistente (documento tem " + total + ")", null);
        }
        return Observation.createNotStarted("render.export", observacoes)
                .lowCardinalityKeyValue("formato", "png")
                .observe(() -> {
                    try {
                        Image imagem = JasperPrintManager.printPageToImage(print, pagina, ZOOM_PREVIEW_PNG);
                        ByteArrayOutputStream saida = new ByteArrayOutputStream();
                        ImageIO.write((BufferedImage) imagem, "png", saida);
                        return saida.toByteArray();
                    } catch (Exception e) {
                        throw new FalhaDeRender("falha no export PNG: " + e.getMessage(), e);
                    }
                });
    }

    /**
     * Reconciliação schema ↔ fill: o `inputSchema` valida payload ANINHADO
     * (`pedido: { numero }`), mas `$F{pedido.numero}` resolve por chave
     * pontuada LITERAL. Além das entradas originais, materializa as folhas de
     * objetos aninhados como chaves pontuadas (`pedido.numero`). Listas ficam
     * intactas (coleções alimentam tabelas/subreports).
     */
    private Map<String, Object> comChavesAchatadas(Map<String, Object> payload) {
        Map<String, Object> registro = new HashMap<>(payload);
        achatar("", payload, registro);
        return registro;
    }

    private void achatar(String prefixo, Map<String, Object> origem, Map<String, Object> destino) {
        for (Map.Entry<String, Object> entrada : origem.entrySet()) {
            String chave = prefixo.isEmpty() ? entrada.getKey() : prefixo + "." + entrada.getKey();
            Object valor = entrada.getValue();
            if (valor instanceof Map<?, ?> aninhado) {
                @SuppressWarnings("unchecked")
                Map<String, Object> mapa = (Map<String, Object>) aninhado;
                achatar(chave, mapa, destino);
            } else if (!prefixo.isEmpty()) {
                destino.putIfAbsent(chave, valor);
            }
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
