package dev.reportlenz.render.pipeline;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.api.Test;

import dev.reportlenz.render.pipeline.ErroDeRender.ExpressaoProibida;

/**
 * Gate G7 (ADR-016, change seguranca-expressoes/1.2-1.3): cenários do spec
 * render-seguranca — RCE, JDBC disfarçado, fuga do método gerado, parâmetros
 * de sistema, scriptlet/import — e o vocabulário legítimo que continua válido.
 */
class SegurancaDeExpressoesTest {

    private final CompiladorJrxml compilador = new CompiladorJrxml();

    private static String jrxmlCom(String expressao) {
        return jrxmlCom(expressao, "", "");
    }

    private static String jrxmlCom(String expressao, String atributosRaiz, String declaracoes) {
        return """
                <?xml version="1.0" encoding="UTF-8"?>
                <jasperReport name="g7" pageWidth="595" pageHeight="842" columnWidth="555" \
                leftMargin="20" rightMargin="20" topMargin="30" bottomMargin="30"%s>
                %s
                \t<parameter name="titulo" class="java.lang.String"/>
                \t<field name="nome" class="java.lang.String"/>
                \t<field name="valor" class="java.math.BigDecimal"/>
                \t<field name="qtd" class="java.math.BigDecimal"/>
                \t<field name="data" class="java.util.Date"/>
                \t<title height="30">
                \t\t<element kind="textField" x="0" y="0" width="555" height="20">
                \t\t\t<expression><![CDATA[%s]]></expression>
                \t\t</element>
                \t</title>
                </jasperReport>
                """.formatted(atributosRaiz, declaracoes, expressao);
    }

    @ParameterizedTest(name = "recusa: {0}")
    @ValueSource(strings = {
            // Scenario: Execução de comando no servidor
            "Runtime.getRuntime().exec(\"id\").toString()",
            "java.lang.Runtime.getRuntime().exec(\"id\").toString()",
            "new ProcessBuilder(\"id\").start().toString()",
            "System.getenv(\"OPENROUTER_API_KEY\")",
            "$F{nome}.getClass().forName(\"java.lang.Runtime\").toString()",
            "String.class.getName()",
            "new java.io.File(\"/etc/passwd\").toString()",
            "java.nio.file.Files.readString(java.nio.file.Path.of(\"/etc/passwd\"))",
            // Scenario: Conexão JDBC dentro de expressão (Pull disfarçado)
            "java.sql.DriverManager.getConnection(\"jdbc:postgresql://erp/db\").toString()",
            // Scenario: Fuga do método gerado
            "\"a\"; Runtime.getRuntime().exec(\"id\"); String x = \"b\"",
            "\"a\" } static { Runtime.getRuntime(); } String y() { return \"b\"",
            "\"a\" /* comentário */",
            "\"a\" // comentário",
            "\"\\u0022 + Runtime.getRuntime() + \\u0022\"",
            "\"\"\"\ntext block\"\"\"",
            // lambdas / method refs / atribuição
            "java.util.List.of(1).stream().map(x -> x).toString()",
            "$F{nome} = \"x\"",
            "((\"a\")",
            // Scenario: Parâmetro de sistema perigoso
            "$P{REPORT_CLASS_LOADER}.toString()",
            "$P{REPORT_CONNECTION}.toString()",
            "$P{REPORT_PARAMETERS_MAP}.get(\"x\").toString()",
            "$P{JASPER_REPORTS_CONTEXT}.toString()"
    })
    void recusaExpressoesForaDaAllowlist(String expressao) {
        assertThatThrownBy(() -> compilador.compilar(jrxmlCom(expressao)))
                .isInstanceOf(ExpressaoProibida.class)
                .hasMessageStartingWith("EXPRESSAO_PROIBIDA");
    }

    @Test
    void violacaoNomeiaOTokenProibido() {
        assertThatThrownBy(() -> compilador.compilar(jrxmlCom("Runtime.getRuntime().exec(\"id\").toString()")))
                .isInstanceOfSatisfying(ExpressaoProibida.class,
                        e -> assertThat(e.violacoes()).anyMatch(v -> v.contains("\"Runtime\"")));
    }

    @ParameterizedTest(name = "aceita: {0}")
    @ValueSource(strings = {
            // Scenario: Vocabulário legítimo continua válido (Assistente B / designer)
            "\"Cliente: \" + $F{nome}",
            "$F{nome} != null ? $F{nome}.toUpperCase() : \"—\"",
            "$F{valor}.multiply($F{qtd}).setScale(2, java.math.RoundingMode.HALF_UP).toString()",
            "$F{valor}.divide($F{qtd}, 2, java.math.RoundingMode.HALF_UP).toPlainString()",
            "$F{valor}.add(java.math.BigDecimal.ONE).toString()",
            "DATEFORMAT($F{data}, \"dd/MM/yyyy\")",
            "TEXT($F{valor}, \"¤ #,##0.00\")",
            "new java.text.SimpleDateFormat(\"dd/MM/yyyy\").format($F{data})",
            "String.valueOf($V{PAGE_NUMBER}) + \" de \" + $V{PAGE_NUMBER}",
            "$V{REPORT_COUNT} % 2 == 0 ? \"par\" : \"ímpar\"",
            "$P{titulo}.equals(\"Fatura\") ? \"F\" : 'x' + \"\"",
            "java.text.NumberFormat.getCurrencyInstance($P{REPORT_LOCALE}).format($F{valor})",
            "\"a // não é comentário dentro de string\"",
            "\"https://exemplo.com.br/logo.png\""
    })
    void aceitaVocabularioLegitimo(String expressao) {
        assertThat(compilador.compilar(jrxmlCom(expressao))).isNotNull();
    }

    @Test
    void recusaScriptletImportELinguagem() {
        // Scenario: Scriptlet declarado
        assertThatThrownBy(() -> compilador.compilar(jrxmlCom("$F{nome}", " scriptletClass=\"x.Malicioso\"", "")))
                .isInstanceOf(ExpressaoProibida.class).hasMessageContaining("scriptletClass");
        assertThatThrownBy(() -> compilador.compilar(
                jrxmlCom("$F{nome}", "", "\t<scriptlet name=\"s\" class=\"x.Malicioso\"/>")))
                .isInstanceOf(ExpressaoProibida.class).hasMessageContaining("scriptlet");
        assertThatThrownBy(() -> compilador.compilar(jrxmlCom("$F{nome}", "", "\t<import>java.io.File</import>")))
                .isInstanceOf(ExpressaoProibida.class).hasMessageContaining("import");
        assertThatThrownBy(() -> compilador.compilar(jrxmlCom("$F{nome}", " formatFactoryClass=\"x.Fabrica\"", "")))
                .isInstanceOf(ExpressaoProibida.class).hasMessageContaining("formatFactoryClass");
    }

    static boolean fixturesDisponiveis() {
        return java.nio.file.Files.exists(FATURA);
    }

    private static final java.nio.file.Path FATURA = java.nio.file.Path.of("../tools/jr7-harness/fixtures/fatura.jrxml");

    @Test
    @org.junit.jupiter.api.condition.EnabledIf("fixturesDisponiveis")
    void recusaExpressaoProibidaEmCelulaDeTabelaEDatasetRun() throws Exception {
        String fatura = java.nio.file.Files.readString(FATURA);
        // A fatura de referência é válida…
        assertThat(compilador.compilar(fatura)).isNotNull();
        // …mas a mesma célula de tabela (dataset itens_ds) com código arbitrário não.
        String adulterada = fatura.replace("<![CDATA[$F{descricao}]]>", "<![CDATA[Runtime.getRuntime().toString()]]>");
        assertThat(adulterada).isNotEqualTo(fatura);
        assertThatThrownBy(() -> compilador.compilar(adulterada))
                .isInstanceOf(ExpressaoProibida.class).hasMessageContaining("Runtime");
        // Expressão do datasetRun (dataSourceExpression) também é coberta.
        String dsAdulterado = fatura.replaceFirst(
                "new net\\.sf\\.jasperreports\\.engine\\.data\\.JRBeanCollectionDataSource\\(\\$F\\{itens\\}\\)",
                "new net.sf.jasperreports.engine.JREmptyDataSource(System.exit(0))");
        assertThat(dsAdulterado).isNotEqualTo(fatura);
        assertThatThrownBy(() -> compilador.compilar(dsAdulterado)).isInstanceOf(ExpressaoProibida.class);
    }

    @Test
    void recusaExpressaoProibidaEmSubDataset() {
        String jrxml = jrxmlCom("$F{nome}", "", """
                \t<dataset name="itens">
                \t\t<field name="descricao" class="java.lang.String"/>
                \t\t<variable name="mal" class="java.lang.String">
                \t\t\t<expression><![CDATA[Runtime.getRuntime().toString()]]></expression>
                \t\t</variable>
                \t</dataset>""");
        assertThatThrownBy(() -> compilador.compilar(jrxml))
                .isInstanceOf(ExpressaoProibida.class).hasMessageContaining("Runtime");
    }
}
