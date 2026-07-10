package dev.reportlenz.render.api;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;

import dev.reportlenz.render.api.PublishControlador.VerificarRequest;
import dev.reportlenz.render.api.PublishControlador.VerificarResponse;
import dev.reportlenz.render.pipeline.CompiladorJrxml;

/**
 * Gates autoritativos do publish (phase-4/4.1-4.3, RFC-006 §3): G1 = Library
 * real, G2 = anti-Pull do compilador, G5 = inputSchema válido, G6 = sha256.
 */
class PublishControladorTest {

    private final PublishControlador controlador = new PublishControlador(new CompiladorJrxml());

    private static final Path FIXTURE_FATURA = Path.of("../tools/jr7-harness/fixtures/fatura.jrxml");

    static boolean fixturesDisponiveis() {
        return Files.exists(FIXTURE_FATURA);
    }

    private static final Map<String, Object> SCHEMA_MINIMO = Map.of(
            "$schema", "https://json-schema.org/draft/2020-12/schema",
            "type", "object",
            "properties", Map.of("titulo", Map.of("type", "string")));

    @Test
    @EnabledIf("fixturesDisponiveis")
    void faturaDeReferenciaPassaEmTodosOsGatesComHashConferindo() throws Exception {
        String jrxml = Files.readString(FIXTURE_FATURA);
        VerificarResponse semHash = controlador.verificar(new VerificarRequest(jrxml, SCHEMA_MINIMO, null));
        assertThat(semHash.verde()).isTrue();

        // Mesmo conteúdo + hash devolvido → G6 consistente.
        VerificarResponse comHash = controlador.verificar(
                new VerificarRequest(jrxml, SCHEMA_MINIMO, semHash.jrxmlHash()));
        assertThat(comHash.verde()).isTrue();
        assertThat(comHash.gates()).allMatch(PublishControlador.Gate::verde);
    }

    @Test
    void pullEmbutidoReprovaG2SemDerrubarOsDemais() {
        String comPull = """
                <?xml version="1.0" encoding="UTF-8"?>
                <jasperReport name="x" pageWidth="595" pageHeight="842" columnWidth="555" \
                leftMargin="20" rightMargin="20" topMargin="30" bottomMargin="30">
                \t<query language="sql"><![CDATA[SELECT 1]]></query>
                \t<detail><band height="20"/></detail>
                </jasperReport>
                """;
        VerificarResponse r = controlador.verificar(new VerificarRequest(comPull, SCHEMA_MINIMO, null));
        assertThat(r.verde()).isFalse();
        PublishControlador.Gate g2 = r.gates().stream().filter(g -> g.gate().equals("G2")).findFirst().orElseThrow();
        assertThat(g2.verde()).isFalse();
        assertThat(String.join("; ", g2.erros())).contains("CONTRACT_PULL_FORBIDDEN");
    }

    @Test
    void jrxmlQueALibraryRecusaReprovaG1EInputSchemaAusenteReprovaG5() {
        VerificarResponse r = controlador.verificar(
                new VerificarRequest("<jasperReport name='x'><banda/></jasperReport>", null, null));
        assertThat(r.verde()).isFalse();
        assertThat(r.gates().stream().filter(g -> g.gate().equals("G1")).findFirst().orElseThrow().verde()).isFalse();
        PublishControlador.Gate g5 = r.gates().stream().filter(g -> g.gate().equals("G5")).findFirst().orElseThrow();
        assertThat(g5.verde()).isFalse();
        assertThat(String.join("", g5.erros())).contains("CONTRACT_MISSING");
    }

    @Test
    @EnabledIf("fixturesDisponiveis")
    void hashDivergenteReprovaG6() throws Exception {
        String jrxml = Files.readString(FIXTURE_FATURA);
        VerificarResponse r = controlador.verificar(new VerificarRequest(
                jrxml, SCHEMA_MINIMO, "0".repeat(64)));
        assertThat(r.verde()).isFalse();
        PublishControlador.Gate g6 = r.gates().stream().filter(g -> g.gate().equals("G6")).findFirst().orElseThrow();
        assertThat(String.join("", g6.erros())).contains("HASH_MISMATCH");
        assertThat(r.gates().stream().filter(g -> List.of("G1", "G2", "G5").contains(g.gate())))
                .allMatch(PublishControlador.Gate::verde);
    }
}
