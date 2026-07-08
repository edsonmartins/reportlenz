package dev.reportlenz.harness;

import java.io.File;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import net.sf.jasperreports.engine.JasperCompileManager;
import net.sf.jasperreports.engine.design.JasperDesign;
import net.sf.jasperreports.engine.xml.JRXmlLoader;

/**
 * Gate G1 (ADR-013): valida arquivos .jrxml contra a JasperReports Library
 * 7.0.7 real — load (desserialização Jackson) + compile (verificação de design
 * e compilação de expressões). Sai com código 1 se qualquer arquivo falhar.
 *
 * Uso: Jr7Harness <arquivo.jrxml | diretório> [...]
 */
public final class Jr7Harness {

    private Jr7Harness() {
    }

    public static void main(String[] args) {
        if (args.length == 0) {
            System.err.println("uso: Jr7Harness <arquivo.jrxml | diretório> [...]");
            System.exit(2);
        }

        List<File> arquivos = new ArrayList<>();
        for (String arg : args) {
            File f = new File(arg);
            if (f.isDirectory()) {
                File[] filhos = f.listFiles((dir, name) -> name.endsWith(".jrxml"));
                if (filhos != null) {
                    Arrays.sort(filhos);
                    arquivos.addAll(Arrays.asList(filhos));
                }
            } else {
                arquivos.add(f);
            }
        }

        if (arquivos.isEmpty()) {
            System.err.println("nenhum .jrxml encontrado nos caminhos informados");
            System.exit(2);
        }

        int falhas = 0;
        for (File arquivo : arquivos) {
            try {
                JasperDesign design = JRXmlLoader.load(arquivo);
                JasperCompileManager.compileReport(design);
                System.out.println("OK    " + arquivo);
            } catch (Exception e) {
                falhas++;
                System.out.println("FALHA " + arquivo);
                System.out.println("      -> " + resumo(e));
            }
        }

        String versao = JasperDesign.class.getPackage().getImplementationVersion();
        System.out.printf("%n%d/%d aceitos pela JasperReports Library %s%n",
                arquivos.size() - falhas, arquivos.size(),
                versao != null ? versao : "(versão não informada no manifest)");
        if (falhas > 0) {
            System.exit(1);
        }
    }

    private static String resumo(Throwable e) {
        StringBuilder sb = new StringBuilder();
        Throwable atual = e;
        while (atual != null && sb.length() < 800) {
            if (sb.length() > 0) {
                sb.append(" | causa: ");
            }
            sb.append(atual.getClass().getSimpleName()).append(": ").append(atual.getMessage());
            atual = atual.getCause();
        }
        return sb.toString();
    }
}
