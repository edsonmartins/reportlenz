package dev.reportlenz.render.pipeline;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import net.sf.jasperreports.engine.JRDataset;
import net.sf.jasperreports.engine.JRField;
import net.sf.jasperreports.engine.JRParameter;
import net.sf.jasperreports.engine.JasperReport;

/**
 * Coerção do payload JSON às classes DECLARADAS no template (aceite da
 * Fase 3, 9.2): o JSON entrega `Double`/`Integer` para números e `String`
 * para datas, mas o fill do engine exige a classe do `<field class>`/
 * `<parameter class>` (`java.math.BigDecimal`, `java.lang.Long`,
 * `java.time.LocalDate`…) — sem coerção, `$F{valor}` explode em
 * ClassCastException dentro do JRExpressionEvalException.
 *
 * A tabela de classes cobre exatamente o subconjunto do jrxml-core
 * (`javaTypes.ts`); valor que não converte volta INTACTO — o engine acusa,
 * nunca mascaramos silenciosamente.
 */
final class CoercaoDePayload {

    private CoercaoDePayload() {}

    /**
     * Classes declaradas por nome, varrendo o dataset principal E os datasets
     * de componentes (tabela): fields e parâmetros não-system.
     */
    static Map<String, Class<?>> classesDeclaradas(JasperReport report) {
        Map<String, Class<?>> classes = new HashMap<>();
        coletar(classes, report.getFields(), report.getParameters());
        if (report.getDatasets() != null) {
            for (JRDataset dataset : report.getDatasets()) {
                coletar(classes, dataset.getFields(), dataset.getParameters());
            }
        }
        return classes;
    }

    private static void coletar(Map<String, Class<?>> destino, JRField[] fields, JRParameter[] parameters) {
        if (fields != null) {
            for (JRField f : fields) {
                destino.putIfAbsent(f.getName(), f.getValueClass());
            }
        }
        if (parameters != null) {
            for (JRParameter p : parameters) {
                if (!p.isSystemDefined()) {
                    destino.putIfAbsent(p.getName(), p.getValueClass());
                }
            }
        }
    }

    /**
     * Coage as entradas do registro (chaves já achatadas) e, dentro de
     * coleções, cada item-mapa — os itens alimentam os datasets de tabela.
     */
    static Map<String, Object> coagirRegistro(Map<String, Object> registro, Map<String, Class<?>> classes) {
        Map<String, Object> resultado = new HashMap<>(registro.size());
        for (Map.Entry<String, Object> entrada : registro.entrySet()) {
            resultado.put(entrada.getKey(), coagirValor(entrada.getKey(), entrada.getValue(), classes));
        }
        return resultado;
    }

    private static Object coagirValor(String nome, Object valor, Map<String, Class<?>> classes) {
        if (valor instanceof List<?> lista) {
            List<Object> itens = new ArrayList<>(lista.size());
            for (Object item : lista) {
                if (item instanceof Map<?, ?> mapa) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> registroDoItem = (Map<String, Object>) mapa;
                    itens.add(coagirRegistro(registroDoItem, classes));
                } else {
                    itens.add(item);
                }
            }
            return itens;
        }
        Class<?> alvo = classes.get(nome);
        return alvo == null ? valor : coagir(valor, alvo);
    }

    /** Converte para a classe alvo quando há conversão canônica; senão devolve intacto. */
    static Object coagir(Object valor, Class<?> alvo) {
        if (valor == null || alvo.isInstance(valor)) {
            return valor;
        }
        if (valor instanceof Number n) {
            if (alvo == BigDecimal.class) return new BigDecimal(n.toString());
            if (alvo == Long.class) return n.longValue();
            if (alvo == Integer.class) return n.intValue();
            if (alvo == Short.class) return n.shortValue();
            if (alvo == Byte.class) return n.byteValue();
            if (alvo == Double.class) return n.doubleValue();
            if (alvo == Float.class) return n.floatValue();
            if (alvo == BigInteger.class) return BigInteger.valueOf(n.longValue());
        }
        if (valor instanceof String s) {
            try {
                if (alvo == LocalDate.class) return LocalDate.parse(s);
                if (alvo == LocalDateTime.class) return LocalDateTime.parse(s);
                if (alvo == java.sql.Date.class) return java.sql.Date.valueOf(LocalDate.parse(s));
                if (alvo == java.sql.Timestamp.class) return java.sql.Timestamp.valueOf(LocalDateTime.parse(s));
                if (alvo == java.util.Date.class) {
                    return java.util.Date.from(LocalDateTime.parse(s).atZone(ZoneId.systemDefault()).toInstant());
                }
                if (alvo == Instant.class) {
                    return LocalDateTime.parse(s).atZone(ZoneId.systemDefault()).toInstant();
                }
            } catch (DateTimeParseException e) {
                return valor; // formato inesperado: o engine acusa com a mensagem dele
            }
        }
        return valor;
    }
}
