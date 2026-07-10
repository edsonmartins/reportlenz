package dev.reportlenz.render.assist;

/**
 * Erros do assistente de IA (RFC-005, ADR-014): indisponibilidade degrada sem
 * quebrar o designer (o front trata 503 como "IA indisponível", padrão do
 * copiloto do mentors-ipaas-admin).
 */
public sealed class ErroDoAssistente extends RuntimeException {

    public ErroDoAssistente(String mensagem, Throwable causa) {
        super(mensagem, causa);
    }

    public ErroDoAssistente(String mensagem) {
        super(mensagem);
    }

    /** Sem chave configurada ou provedor fora do ar → 503 IA_INDISPONIVEL. */
    public static final class IaIndisponivel extends ErroDoAssistente {
        public IaIndisponivel(String mensagem, Throwable causa) {
            super(mensagem, causa);
        }

        public IaIndisponivel(String mensagem) {
            super(mensagem);
        }
    }

    /** O modelo respondeu algo que não é o JSON esperado → 502 IA_RESPOSTA_INVALIDA. */
    public static final class RespostaInvalida extends ErroDoAssistente {
        public RespostaInvalida(String mensagem, Throwable causa) {
            super(mensagem, causa);
        }
    }
}
