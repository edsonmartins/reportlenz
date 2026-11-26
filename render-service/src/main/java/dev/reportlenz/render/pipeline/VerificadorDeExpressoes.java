package dev.reportlenz.render.pipeline;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

import dev.reportlenz.render.pipeline.ErroDeRender.ExpressaoProibida;
import net.sf.jasperreports.engine.DefaultJasperReportsContext;
import net.sf.jasperreports.engine.JRDataset;
import net.sf.jasperreports.engine.JRExpression;
import net.sf.jasperreports.engine.JRExpressionChunk;
import net.sf.jasperreports.engine.JRExpressionCollector;
import net.sf.jasperreports.engine.JRField;
import net.sf.jasperreports.engine.JRParameter;
import net.sf.jasperreports.engine.JRReport;
import net.sf.jasperreports.engine.JRVariable;
import net.sf.jasperreports.engine.design.JasperDesign;
import net.sf.jasperreports.engine.type.ExpressionTypeEnum;

/**
 * Gate G7 — segurança de expressão (ADR-016, change seguranca-expressoes).
 *
 * Expressões JasperReports são Java compilado SEM sandbox. Este verificador
 * roda ANTES do compile e só aceita o vocabulário de valor que o designer e o
 * Assistente B emitem: referências $F/$P/$V/$R (operandos opacos, via chunks),
 * literais, operadores e identificadores/membros em allowlist. Na dúvida,
 * recusa — a allowlist é conservadora por construção.
 *
 * Também recusa as formas de o JRXML instanciar classes por nome (imports,
 * scriptlets, factories, customizers) e linguagem diferente de Java.
 */
public final class VerificadorDeExpressoes {

    private VerificadorDeExpressoes() {}

    /** Tipos utilizáveis (simples ou qualificados nos pacotes abaixo). */
    static final Set<String> TIPOS = Set.of(
            "Object", "String", "Math", "Integer", "Long", "Double", "Float", "Short", "Byte", "Boolean",
            "Character", "Number", "BigDecimal", "BigInteger", "RoundingMode", "MathContext", "Locale",
            "Date", "SimpleDateFormat", "DecimalFormat", "NumberFormat", "DecimalFormatSymbols",
            "MessageFormat", "LocalDate", "LocalDateTime", "LocalTime", "OffsetDateTime", "ZonedDateTime",
            "Instant", "ZoneId", "ZoneOffset", "Duration", "Period", "DateTimeFormatter", "ChronoUnit",
            "List", "Map", "Collection", "ArrayList", "Arrays", "Collections", "Objects",
            "JRBeanCollectionDataSource", "JRMapCollectionDataSource", "JREmptyDataSource");

    /** Pacotes aceitos em nomes qualificados (`java.math.BigDecimal`). */
    static final Set<String> PACOTES = Set.of(
            "java.lang", "java.math", "java.text", "java.time", "java.time.format", "java.time.temporal",
            "java.util", "net.sf.jasperreports.engine.data");

    /** Membros (após `.`) aceitos — métodos de VALOR; nada de reflexão/IO/processo. */
    static final Set<String> MEMBROS = Set.of(
            "equals", "equalsIgnoreCase", "compareTo", "compareToIgnoreCase", "toString", "toUpperCase",
            "toLowerCase", "trim", "strip", "stripLeading", "stripTrailing", "isEmpty", "isBlank", "length",
            "substring", "indexOf", "lastIndexOf", "charAt", "contains", "startsWith", "endsWith", "replace",
            "replaceAll", "concat", "format", "formatted", "valueOf", "join", "repeat", "split", "matches",
            "add", "subtract", "multiply", "divide", "remainder", "negate", "abs", "setScale", "scale",
            "precision", "signum", "intValue", "longValue", "doubleValue", "floatValue", "shortValue",
            "byteValue", "booleanValue", "toPlainString", "stripTrailingZeros", "max", "min", "round",
            "floor", "ceil", "pow", "sqrt", "parseInt", "parseLong", "parseDouble", "parseBoolean", "size",
            "get", "getOrDefault", "containsKey", "of", "ofPattern", "parse", "now", "getYear", "getMonth",
            "getMonthValue", "getDayOfMonth", "getDayOfWeek", "getHour", "getMinute", "getSecond",
            "plusDays", "plusMonths", "plusYears", "minusDays", "minusMonths", "minusYears", "atStartOfDay",
            "toLocalDate", "getTime", "getInstance", "getCurrencyInstance", "getNumberInstance",
            "getPercentInstance", "getIntegerInstance", "forLanguageTag", "asList", "emptyList",
            "requireNonNullElse", "isEqual", "isBefore", "isAfter", "between", "toEpochDay", "withLocale");

    /** Palavras-chave permitidas fora de posição de membro. */
    static final Set<String> PALAVRAS = Set.of("new", "true", "false", "null", "instanceof");

    /** Parâmetros de sistema liberados; os demais expõem conexão, class loader, contexto… */
    static final Set<String> PARAMETROS_DE_SISTEMA_PERMITIDOS = Set.of(
            JRParameter.REPORT_LOCALE, JRParameter.REPORT_TIME_ZONE);

    /** Nomes de builtins conhecidos (defesa extra caso isSystemDefined não venha marcado). */
    static final Set<String> PARAMETROS_DE_SISTEMA = Set.of(
            JRParameter.REPORT_PARAMETERS_MAP, JRParameter.JASPER_REPORTS_CONTEXT, JRParameter.JASPER_REPORT,
            JRParameter.REPORT_CONNECTION, JRParameter.REPORT_MAX_COUNT, JRParameter.REPORT_DATA_SOURCE,
            JRParameter.REPORT_SCRIPTLET, JRParameter.REPORT_LOCALE, JRParameter.REPORT_RESOURCE_BUNDLE,
            JRParameter.REPORT_TIME_ZONE, JRParameter.REPORT_FORMAT_FACTORY, JRParameter.REPORT_CLASS_LOADER,
            JRParameter.REPORT_TEMPLATES, JRParameter.SORT_FIELDS, JRParameter.FILTER,
            JRParameter.REPORT_VIRTUALIZER, JRParameter.IS_IGNORE_PAGINATION, JRParameter.REPORT_CONTEXT);

    /** Operadores multi-caractere, do mais longo ao mais curto. */
    private static final List<String> OPERADORES = List.of(
            ">>>=", "<<=", ">>=", ">>>", "==", "!=", "<=", ">=", "&&", "||", "++", "--", "+=", "-=", "*=",
            "/=", "%=", "&=", "|=", "^=", "->", "::", "<<", ">>");

    /** Operadores aceitos (atribuição, lambda e method reference ficam fora). */
    private static final Set<String> OPERADORES_PERMITIDOS = Set.of(
            "==", "!=", "<=", ">=", "&&", "||", "<<", ">>", ">>>", "+", "-", "*", "/", "%", "<", ">", "!",
            "&", "|", "^", "~", "?", ":", ".", ",", "(", ")", "[", "]");

    private static final Pattern NOME_DE_CLASSE =
            Pattern.compile("[A-Za-z_][A-Za-z0-9_]*(\\.[A-Za-z_][A-Za-z0-9_]*)*(\\[\\])*");

    private static final Pattern MAIUSCULO = Pattern.compile("[A-Z][A-Z0-9_]*");

    /** Atributos que instanciam classe por nome e não têm getter uniforme no design. */
    private static final Pattern ATRIBUTO_DE_CLASSE = Pattern.compile("\\bcustomizerClass\\s*=");

    /**
     * Verifica o design completo. Lança {@link ExpressaoProibida} com TODAS as
     * violações encontradas (o publish mostra a lista no G7).
     */
    public static void verificar(JasperDesign design, String jrxmlBruto) {
        List<String> violacoes = violacoes(design, jrxmlBruto);
        if (!violacoes.isEmpty()) {
            throw new ExpressaoProibida(violacoes);
        }
    }

    static List<String> violacoes(JasperDesign design, String jrxmlBruto) {
        Set<String> violacoes = new LinkedHashSet<>();
        verificarEstrutura(design, jrxmlBruto, violacoes);

        Set<String> sistema = new HashSet<>(PARAMETROS_DE_SISTEMA);
        List<JRDataset> datasets = new ArrayList<>();
        datasets.add(design.getMainDataset());
        datasets.addAll(design.getDatasetsList());
        for (JRDataset ds : datasets) {
            for (JRParameter p : ds.getParameters()) {
                if (p.isSystemDefined()) {
                    sistema.add(p.getName());
                }
            }
        }

        JRExpressionCollector coletor = JRExpressionCollector.collector(DefaultJasperReportsContext.getInstance(), design);
        Set<JRExpression> expressoes = new LinkedHashSet<>(coletor.getExpressions());
        for (JRDataset ds : design.getDatasetsList()) {
            expressoes.addAll(coletor.getExpressions(ds));
        }
        for (JRExpression expressao : expressoes) {
            verificarExpressao(expressao, sistema, violacoes);
        }
        return List.copyOf(violacoes);
    }

    private static void verificarEstrutura(JasperDesign design, String bruto, Set<String> v) {
        String linguagem = design.getLanguage();
        if (linguagem != null && !JRReport.LANGUAGE_JAVA.equalsIgnoreCase(linguagem)) {
            v.add("language=\"" + linguagem + "\" não permitida (só java)");
        }
        if (design.getImports() != null && design.getImports().length > 0) {
            v.add("<import> não permitido");
        }
        if (design.getFormatFactoryClass() != null) {
            v.add("formatFactoryClass não permitido");
        }
        if (bruto != null && ATRIBUTO_DE_CLASSE.matcher(bruto).find()) {
            v.add("customizerClass não permitido");
        }
        List<JRDataset> datasets = new ArrayList<>();
        datasets.add(design.getMainDataset());
        datasets.addAll(design.getDatasetsList());
        for (JRDataset ds : datasets) {
            String nome = ds.isMainDataset() ? "relatório" : "dataset \"" + ds.getName() + "\"";
            if (ds.getScriptletClass() != null && !ds.getScriptletClass().isBlank()) {
                v.add("scriptletClass não permitido (" + nome + ")");
            }
            if (ds.getScriptlets() != null && ds.getScriptlets().length > 0) {
                v.add("<scriptlet> não permitido (" + nome + ")");
            }
            for (JRField f : ds.getFields()) {
                verificarNomeDeClasse(f.getValueClassName(), "field " + f.getName(), v);
            }
            for (JRParameter p : ds.getParameters()) {
                if (!p.isSystemDefined()) {
                    verificarNomeDeClasse(p.getValueClassName(), "parameter " + p.getName(), v);
                }
            }
            for (JRVariable var : ds.getVariables()) {
                if (!var.isSystemDefined()) {
                    verificarNomeDeClasse(var.getValueClassName(), "variable " + var.getName(), v);
                    if (var.getIncrementerFactoryClassName() != null) {
                        v.add("incrementerFactoryClass não permitido (variable " + var.getName() + ")");
                    }
                }
            }
        }
    }

    private static void verificarNomeDeClasse(String nome, String onde, Set<String> v) {
        if (nome != null && !NOME_DE_CLASSE.matcher(nome).matches()) {
            v.add("nome de classe inválido em " + onde);
        }
    }

    // ------------------------------------------------------------------ léxico

    enum Tipo { IDENT, NUMERO, TEXTO, OP, REF }

    record Token(Tipo tipo, String texto) {}

    private static void verificarExpressao(JRExpression expressao, Set<String> sistema, Set<String> v) {
        JRExpressionChunk[] chunks = expressao.getChunks();
        if (chunks == null) {
            return;
        }
        boolean textoSimples = expressao.getType() == ExpressionTypeEnum.SIMPLE_TEXT;
        List<Token> tokens = new ArrayList<>();
        for (JRExpressionChunk chunk : chunks) {
            switch (chunk.getType()) {
                case JRExpressionChunk.TYPE_TEXT -> {
                    if (!textoSimples) {
                        // Expressão simples (texto) vira literal no Java gerado — sem código.
                        try {
                            tokens.addAll(tokenizar(chunk.getText()));
                        } catch (IllegalArgumentException e) {
                            v.add(e.getMessage() + " em: " + resumo(expressao.getText()));
                            return;
                        }
                    }
                }
                case JRExpressionChunk.TYPE_PARAMETER -> {
                    String nome = chunk.getText();
                    if (sistema.contains(nome) && !PARAMETROS_DE_SISTEMA_PERMITIDOS.contains(nome)) {
                        v.add("parâmetro de sistema $P{" + nome + "} não permitido");
                    }
                    tokens.add(new Token(Tipo.REF, nome));
                }
                default -> tokens.add(new Token(Tipo.REF, chunk.getText()));
            }
        }
        String erro = verificarTokens(tokens);
        if (erro != null) {
            v.add(erro + " em: " + resumo(expressao.getText()));
        }
    }

    /** Aplica a allowlist sobre a sequência de tokens; null = aceita. */
    static String verificarTokens(List<Token> tokens) {
        int parenteses = 0;
        for (int i = 0; i < tokens.size(); i++) {
            Token t = tokens.get(i);
            switch (t.tipo()) {
                case OP -> {
                    if (!OPERADORES_PERMITIDOS.contains(t.texto())) {
                        return "operador \"" + t.texto() + "\" não permitido";
                    }
                    if (t.texto().equals("(")) {
                        parenteses++;
                    } else if (t.texto().equals(")") && --parenteses < 0) {
                        return "parênteses desbalanceados";
                    }
                }
                case IDENT -> {
                    boolean membro = i > 0 && tokens.get(i - 1).tipo() == Tipo.OP && tokens.get(i - 1).texto().equals(".");
                    String nome = t.texto();
                    if (membro) {
                        if (!MEMBROS.contains(nome) && !MAIUSCULO.matcher(nome).matches()) {
                            return "membro \"" + nome + "\" não permitido";
                        }
                    } else if (nome.equals("java") || nome.equals("net")) {
                        int fim = consumirQualificado(tokens, i);
                        if (fim < 0) {
                            return "nome qualificado \"" + qualificado(tokens, i) + "\" não permitido";
                        }
                        i = fim;
                    } else if (!PALAVRAS.contains(nome) && !TIPOS.contains(nome) && !MAIUSCULO.matcher(nome).matches()) {
                        return "identificador \"" + nome + "\" não permitido";
                    }
                }
                default -> { /* literais e referências são operandos */ }
            }
        }
        return parenteses == 0 ? null : "parênteses desbalanceados";
    }

    /**
     * Casa `pacote.permitido.TipoPermitido` a partir de tokens[inicio]; devolve
     * o índice do token do TIPO (os segmentos seguintes seguem como membros),
     * ou -1 se nenhum prefixo permitido casar.
     */
    private static int consumirQualificado(List<Token> tokens, int inicio) {
        StringBuilder pacote = new StringBuilder(tokens.get(inicio).texto());
        int i = inicio;
        while (i + 2 < tokens.size() && ehPonto(tokens.get(i + 1)) && tokens.get(i + 2).tipo() == Tipo.IDENT) {
            String seguinte = tokens.get(i + 2).texto();
            if (PACOTES.contains(pacote.toString()) && TIPOS.contains(seguinte)) {
                return i + 2;
            }
            pacote.append('.').append(seguinte);
            i += 2;
        }
        return -1;
    }

    private static String qualificado(List<Token> tokens, int inicio) {
        StringBuilder sb = new StringBuilder(tokens.get(inicio).texto());
        int i = inicio;
        while (i + 2 < tokens.size() && ehPonto(tokens.get(i + 1)) && tokens.get(i + 2).tipo() == Tipo.IDENT) {
            sb.append('.').append(tokens.get(i + 2).texto());
            i += 2;
        }
        return sb.toString();
    }

    private static boolean ehPonto(Token t) {
        return t.tipo() == Tipo.OP && t.texto().equals(".");
    }

    /** Tokenizador Java mínimo; lança IllegalArgumentException em construção proibida. */
    static List<Token> tokenizar(String s) {
        if (s.contains("\\u")) {
            // O javac processa escapes Unicode ANTES do léxico — """ fecharia uma string.
            throw new IllegalArgumentException("escape Unicode (\\u) não permitido");
        }
        List<Token> tokens = new ArrayList<>();
        int i = 0;
        int n = s.length();
        while (i < n) {
            char c = s.charAt(i);
            if (Character.isWhitespace(c)) {
                i++;
            } else if (c == '"') {
                if (s.startsWith("\"\"\"", i)) {
                    throw new IllegalArgumentException("text block (\"\"\") não permitido");
                }
                int j = i + 1;
                while (j < n && s.charAt(j) != '"') {
                    if (s.charAt(j) == '\\') {
                        j++;
                    }
                    if (j < n && (s.charAt(j) == '\n' || s.charAt(j) == '\r')) {
                        throw new IllegalArgumentException("string não terminada");
                    }
                    j++;
                }
                if (j >= n) {
                    throw new IllegalArgumentException("string não terminada");
                }
                tokens.add(new Token(Tipo.TEXTO, s.substring(i, j + 1)));
                i = j + 1;
            } else if (c == '\'') {
                int j = i + 1;
                if (j < n && s.charAt(j) == '\\') {
                    j++;
                }
                j++;
                if (j >= n || s.charAt(j) != '\'') {
                    throw new IllegalArgumentException("literal de caractere inválido");
                }
                tokens.add(new Token(Tipo.TEXTO, s.substring(i, j + 1)));
                i = j + 1;
            } else if (Character.isDigit(c) || (c == '.' && i + 1 < n && Character.isDigit(s.charAt(i + 1)))) {
                int j = i + 1;
                while (j < n && (Character.isLetterOrDigit(s.charAt(j)) || s.charAt(j) == '.' || s.charAt(j) == '_')) {
                    j++;
                }
                tokens.add(new Token(Tipo.NUMERO, s.substring(i, j)));
                i = j;
            } else if (Character.isJavaIdentifierStart(c) && c != '$') {
                int j = i + 1;
                while (j < n && Character.isJavaIdentifierPart(s.charAt(j)) && s.charAt(j) != '$') {
                    j++;
                }
                if (j < n && s.charAt(j) == '$') {
                    throw new IllegalArgumentException("caractere \"$\" fora de referência");
                }
                tokens.add(new Token(Tipo.IDENT, s.substring(i, j)));
                i = j;
            } else if (c == '/' && i + 1 < n && (s.charAt(i + 1) == '/' || s.charAt(i + 1) == '*')) {
                throw new IllegalArgumentException("comentário não permitido");
            } else {
                String op = null;
                for (String candidato : OPERADORES) {
                    if (s.startsWith(candidato, i)) {
                        op = candidato;
                        break;
                    }
                }
                if (op == null) {
                    if ("+-*/%<>=!&|^~?:.,()[]".indexOf(c) < 0) {
                        throw new IllegalArgumentException("caractere \"" + c + "\" não permitido");
                    }
                    op = String.valueOf(c);
                }
                tokens.add(new Token(Tipo.OP, op));
                i += op.length();
            }
        }
        return tokens;
    }

    private static String resumo(String texto) {
        if (texto == null) {
            return "";
        }
        String uma = texto.replaceAll("\\s+", " ").strip();
        return uma.length() > 120 ? uma.substring(0, 117) + "..." : uma;
    }
}
