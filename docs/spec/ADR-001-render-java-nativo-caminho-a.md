# ADR-001 — Render Java-nativo com JasperReports (Caminho A)

- **Status:** Accepted
- **Data:** 2026-06-28
- **Decisores:** Edson Martins (Arquitetura)
- **Supersede:** —
- **Relacionado:** ADR-002, ADR-004, ADR-008, ADR-011, ADR-012

## Contexto

ReportLenz precisa de um designer web de templates de impressão (faturas, comprovantes, formulários,
relatórios) cujo output seja gerado em produção em escala — incluindo lotes (ex.: ~17.000 comprovantes
da Rio Quality). A decisão estrutural não é "qual designer", e sim **onde o render mora**, porque isso
determina latência, throughput, integração com o stack e fidelidade do preview.

Três caminhos foram avaliados:

- **Caminho A — Java-nativo (JasperReports):** designer gera JRXML; render via JasperReports Library
  embarcada no Spring Boot.
- **Caminho B — Node sidecar (pdfme):** designer React/pdfme; render num microserviço Node/Bun que
  recebe `{template, payload}` e devolve bytes; Spring orquestra.
- **Caminho C — híbrido:** designer React próprio que **exporta JRXML**, render em Jasper.

O time é predominantemente Java/Spring Boot (30+ anos de Java). Há um fork pessoal já guardado do
`jrxml_web_designer`, sinalizando inclinação ao mundo JasperReports.

## Decisão

Adotar o **Caminho A**: o render é executado nativamente em Java, pela **JasperReports Library 7.0.7**
(ver ADR-002) embarcada no Spring Boot. O designer web produz **JRXML** (e o contrato de dados associado),
que o backend compila (`JasperCompileManager`), preenche (`JasperFillManager`) e exporta
(`JasperExportManager`, artefato `jasperreports-pdf`).

## Alternativas e por que foram preteridas

### Caminho B (Node/Bun sidecar com pdfme) — preterido
- **A favor:** WYSIWYG pixel-perfect (mesmo engine no browser e no batch), stack React, fidelidade de PDF
  vetorial (pdf-lib). Bun viabiliza um sidecar leve (binário único, startup rápido).
- **Contra (decisivo):** introduz um runtime adicional (Node/Bun) num ambiente Java; o engine pdfme não
  cobre relatórios corporativos densos (grupos, subtotais, subreports) com a maturidade do Jasper; e o
  time não reaproveita 30 anos de experiência Java nem a Library madura.
- Registrado como caminho viável caso o invariante de "tudo em Java" seja revisto.

### Caminho C (designer React exportando JRXML) — preterido como fundação
- **A favor:** melhor dos dois mundos (UI React moderna + engine Jasper).
- **Contra:** é o mais caro de construir do zero; o serializer JRXML correto é o trabalho difícil. Na
  prática, **a Fase 2 do Caminho A converge para o Caminho C** (casca React sobre `jrxml-core` que
  serializa JRXML). Portanto C não é uma alternativa, é o estado final do A após a migração de UI.

## Consequências

### Positivas
- Render maduro, pixel-perfect, com binding robusto (datasources, grupos, subreports) já resolvido.
- Zero tensão de runtime: render é uma dependência Maven dentro do Spring Boot.
- O endpoint de render serve tanto o preview (ADR-008) quanto o batch — não há trabalho jogado fora.
- Licença LGPLv3 compatível com produto fechado em uso server-side (ADR-006).

### Negativas / mitigações
- **Perde WYSIWYG instantâneo nativo**: o browser não renderiza Jasper. Mitigado pelo preview round-trip
  de duas velocidades (ADR-008) — aproximação no browser + render real sob demanda com compile cache.
- **JasperReports é nativamente Pull**: risco de SQL embutido no relatório, ferindo LGPD. Mitigado pela
  proibição de `<queryString>` e pelo modelo contract-first/Push (ADR-003), usando
  `JRBeanCollectionDataSource`/`Map` montado no backend.
- **Não cobre térmica/ZPL**: fora de escopo do engine; pipeline separado (ADR-011).

## Caveat de licença

A JasperReports Library é LGPLv3 (ver ADR-006). O uso server-side como dependência, sem modificar nem
redistribuir o JAR, mantém o produto fechado. Modificar a Library aciona copyleft — proibido sem ADR.
