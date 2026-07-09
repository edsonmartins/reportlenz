package dev.reportlenz.render.pipeline;

import java.util.function.Function;

import net.sf.jasperreports.engine.JasperReport;

/**
 * Compile cache por `sha256(jrxml)` (ADR-008, tarefa phase-1/2.2): recompila
 * apenas quando o template muda; preview repetido com dados variados não
 * recompila. A chave coincide com o `jrxml_hash` da versão (ADR-009), o que
 * permitirá invalidação on publish.
 */
public interface CacheDeCompilacao {

    /** Retorna o compilado do cache ou compila e armazena (chave = sha256 do jrxml). */
    JasperReport obterOuCompilar(String jrxml, Function<String, JasperReport> compilacao);
}
