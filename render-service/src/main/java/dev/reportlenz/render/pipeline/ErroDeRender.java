package dev.reportlenz.render.pipeline;

/**
 * Hierarquia de erros do pipeline de render (RFC-003 §3/§4). Cada tipo mapeia
 * para um status HTTP no endpoint (tarefas 2.1/2.3): JRXML inválido e Pull →
 * 400; falha de fill/export → 500.
 */
public sealed class ErroDeRender extends RuntimeException {

    public ErroDeRender(String mensagem, Throwable causa) {
        super(mensagem, causa);
    }

    public ErroDeRender(String mensagem) {
        super(mensagem);
    }

    /** JRXML não carrega/não compila no dialeto 7 (Library 7.0.7). */
    public static final class JrxmlInvalido extends ErroDeRender {
        public JrxmlInvalido(String mensagem, Throwable causa) {
            super(mensagem, causa);
        }
    }

    /** JRXML embute fonte de dados (query/conexão) — Pull proibido (ADR-003, I-3). */
    public static final class PullProibido extends ErroDeRender {
        public PullProibido(String mensagem) {
            super(mensagem);
        }
    }

    /** Falha durante fill/export (template válido, render não concluiu). */
    public static final class FalhaDeRender extends ErroDeRender {
        public FalhaDeRender(String mensagem, Throwable causa) {
            super(mensagem, causa);
        }
    }
}
