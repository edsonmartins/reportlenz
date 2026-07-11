package dev.reportlenz.render.publish;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import tools.jackson.databind.json.JsonMapper;

/**
 * Ciclo de vida do template (phase-4/5.1-5.3, ADR-009/RFC-006 §2 e §7):
 * draft mutável → publish com gates → published IMUTÁVEL (nova edição = nova
 * versão; supersede deprecia a anterior) + auditoria de publish e batch.
 */
@SpringBootTest
@AutoConfigureMockMvc
class CicloDeVidaDoTemplateTest {

    private static final Path FIXTURE_FATURA = Path.of("../tools/jr7-harness/fixtures/fatura.jrxml");

    static boolean fixturesDisponiveis() {
        return Files.exists(FIXTURE_FATURA);
    }

    @Autowired
    private MockMvc mvc;

    @Autowired
    private RepositorioDeTemplates repositorio;

    private final JsonMapper json = JsonMapper.builder().build();

    private static final Map<String, Object> SCHEMA = Map.of(
            "$schema", "https://json-schema.org/draft/2020-12/schema",
            "type", "object",
            "properties", Map.of("titulo", Map.of("type", "string")));

    private String salvarBody(String jrxml) {
        return json.writeValueAsString(Map.of("jrxml", jrxml, "inputSchema", SCHEMA, "actor", "edson"));
    }

    @Test
    @EnabledIf("fixturesDisponiveis")
    void cicloCompleto_draftMutavel_publishComGates_imutabilidade_supersede_auditoria() throws Exception {
        String codename = "fatura-" + UUID.randomUUID();
        String jrxml = Files.readString(FIXTURE_FATURA);

        // 1) draft v1 (auditoria 'created').
        mvc.perform(post("/templates/{c}/versoes", codename)
                        .contentType(MediaType.APPLICATION_JSON).content(salvarBody(jrxml)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(1))
                .andExpect(jsonPath("$.novaVersao").value(true));

        // 2) draft é MUTÁVEL: salvar de novo NÃO abre versão nova.
        mvc.perform(post("/templates/{c}/versoes", codename)
                        .contentType(MediaType.APPLICATION_JSON).content(salvarBody(jrxml + "\n")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(1))
                .andExpect(jsonPath("$.novaVersao").value(false));

        // 3) publish v1 (gates verdes) → published.
        mvc.perform(post("/templates/{c}/versoes/1/publicar", codename)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"actor\":\"edson\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("published"));

        // 4) published é IMUTÁVEL: publicar de novo → 409; salvar → NOVA versão v2.
        mvc.perform(post("/templates/{c}/versoes/1/publicar", codename)
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("VERSAO_IMUTAVEL"));
        mvc.perform(post("/templates/{c}/versoes", codename)
                        .contentType(MediaType.APPLICATION_JSON).content(salvarBody(jrxml)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(2))
                .andExpect(jsonPath("$.novaVersao").value(true));

        // 5) publish v2 → supersede: v1 vira deprecated automaticamente.
        mvc.perform(post("/templates/{c}/versoes/2/publicar", codename)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"actor\":\"edson\"}"))
                .andExpect(status().isOk());
        mvc.perform(get("/templates/{c}", codename))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].status").value("deprecated"))
                .andExpect(jsonPath("$[1].status").value("published"));

        // 6) auditoria (RFC-006 §4): trilha completa por versão.
        var v1 = repositorio.consultar(codename, 1).orElseThrow();
        assertThat(repositorio.acoesAuditadas(v1.id())).containsExactly("created", "published", "deprecated");
    }

    @Test
    @EnabledIf("fixturesDisponiveis")
    void validacaoDuplaNoSave_recusaPull_ePublishBloqueiaSemContrato() throws Exception {
        String codename = "invalido-" + UUID.randomUUID();
        String comPull = Files.readString(FIXTURE_FATURA).replaceFirst("<style ",
                "<query language=\"sql\"><![CDATA[SELECT 1]]></query>\n\t<style ");

        // Save recusa Pull (G2) — nem draft entra (ADR-009 regra 2).
        mvc.perform(post("/templates/{c}/versoes", codename)
                        .contentType(MediaType.APPLICATION_JSON).content(salvarBody(comPull)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.codigo").value("SAVE_REPROVADO"));

        // Draft sem inputSchema salva (G5 não é gate de save), mas o PUBLISH bloqueia.
        String semSchema = json.writeValueAsString(Map.of("jrxml", Files.readString(FIXTURE_FATURA)));
        mvc.perform(post("/templates/{c}/versoes", codename)
                        .contentType(MediaType.APPLICATION_JSON).content(semSchema))
                .andExpect(status().isOk());
        mvc.perform(post("/templates/{c}/versoes/1/publicar", codename)
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.codigo").value("PUBLISH_BLOQUEADO"));
    }

    @Test
    @EnabledIf("fixturesDisponiveis")
    void batchPorCodename_soVersaoPublished_eAuditaRenderedBatch() throws Exception {
        String codename = "batch-" + UUID.randomUUID();
        String jrxml = Files.readString(FIXTURE_FATURA);

        // Draft não rende em produção (RFC-006 §2).
        mvc.perform(post("/templates/{c}/versoes", codename)
                        .contentType(MediaType.APPLICATION_JSON).content(salvarBody(jrxml)))
                .andExpect(status().isOk());
        String pedido = json.writeValueAsString(Map.of(
                "templateCodename", codename,
                "payloads", java.util.List.of(Map.of("titulo", "Fatura 1", "total", 10.0)),
                "idempotencyKey", "lote-" + codename));
        mvc.perform(post("/render/batch").contentType(MediaType.APPLICATION_JSON).content(pedido))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("TEMPLATE_NAO_PUBLICADO"));

        // Publicada → 202 e auditoria 'rendered_batch' na versão.
        mvc.perform(post("/templates/{c}/versoes/1/publicar", codename)
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isOk());
        mvc.perform(post("/render/batch").contentType(MediaType.APPLICATION_JSON).content(pedido))
                .andExpect(status().isAccepted());

        var v1 = repositorio.consultar(codename, 1).orElseThrow();
        assertThat(repositorio.acoesAuditadas(v1.id())).contains("rendered_batch");
    }
}
