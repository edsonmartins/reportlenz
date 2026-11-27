package dev.reportlenz.render.seguranca;

/** Normaliza `reportlenz.api.prefixo` (ADR-026 §3): "" ou "/algo" sem barra final. */
public final class PrefixoDaApi {

    private PrefixoDaApi() {}

    public static String normalizar(String prefixo) {
        if (prefixo == null) return "";
        String p = prefixo.strip();
        while (p.endsWith("/")) p = p.substring(0, p.length() - 1);
        if (p.isEmpty()) return "";
        return p.startsWith("/") ? p : "/" + p;
    }
}
