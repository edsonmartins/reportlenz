package dev.reportlenz.render.limites;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Limite de tamanho do corpo (ADR-018 §2): 413 `REQUISICAO_GRANDE_DEMAIS`
 * acima de `reportlenz.limites.max-request-mb`. Roda ANTES da segurança —
 * corpo gigante é recusado sem custo de autenticação/parse.
 *
 * Com Content-Length: decide pelo cabeçalho. Sem ele (chunked): lê até
 * limite+1 bytes; se passar, 413; senão repassa o corpo já lido.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class LimiteDeRequisicao extends OncePerRequestFilter {

    private final long limiteBytes;

    public LimiteDeRequisicao(@Value("${reportlenz.limites.max-request-mb:25}") long limiteMb) {
        this.limiteBytes = limiteMb * 1024 * 1024;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        long declarado = request.getContentLengthLong();
        if (declarado > limiteBytes) {
            recusar(response);
            return;
        }
        if (declarado < 0 && temCorpo(request)) {
            byte[] corpo = request.getInputStream().readNBytes((int) Math.min(Integer.MAX_VALUE - 8, limiteBytes + 1));
            if (corpo.length > limiteBytes) {
                recusar(response);
                return;
            }
            chain.doFilter(new CorpoLido(request, corpo), response);
            return;
        }
        chain.doFilter(request, response);
    }

    private static boolean temCorpo(HttpServletRequest request) {
        String metodo = request.getMethod();
        return "POST".equals(metodo) || "PUT".equals(metodo) || "PATCH".equals(metodo);
    }

    private void recusar(HttpServletResponse response) throws IOException {
        response.setStatus(HttpServletResponse.SC_REQUEST_ENTITY_TOO_LARGE);
        response.setContentType("application/json");
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write("{\"codigo\":\"REQUISICAO_GRANDE_DEMAIS\",\"mensagem\":\"corpo acima de "
                + (limiteBytes / (1024 * 1024)) + " MB (REPORTLENZ_MAX_REQUEST_MB)\"}");
    }

    /** Requisição cujo corpo já foi lido (e medido) pelo filtro. */
    private static final class CorpoLido extends HttpServletRequestWrapper {
        private final byte[] corpo;

        CorpoLido(HttpServletRequest request, byte[] corpo) {
            super(request);
            this.corpo = corpo;
        }

        @Override
        public int getContentLength() {
            return corpo.length;
        }

        @Override
        public long getContentLengthLong() {
            return corpo.length;
        }

        @Override
        public ServletInputStream getInputStream() {
            InputStream origem = new ByteArrayInputStream(corpo);
            return new ServletInputStream() {
                @Override
                public int read() throws IOException {
                    return origem.read();
                }

                @Override
                public int read(byte[] b, int off, int len) throws IOException {
                    return origem.read(b, off, len);
                }

                @Override
                public boolean isFinished() {
                    try {
                        return origem.available() == 0;
                    } catch (IOException e) {
                        return true;
                    }
                }

                @Override
                public boolean isReady() {
                    return true;
                }

                @Override
                public void setReadListener(ReadListener listener) {
                    throw new UnsupportedOperationException("leitura síncrona");
                }
            };
        }
    }
}
