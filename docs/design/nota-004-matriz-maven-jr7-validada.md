# Nota de design 004 — Matriz Maven da JasperReports 7.0.7 validada

- **Data:** 2026-07-09
- **Tarefa:** phase-1/1.1
- **Relacionado:** ADR-007, RFC-003, CLAUDE.md §8.2 (verificação pendente — **resolvida**)

## Resultado

A matriz do ADR-007 foi validada contra o **Maven Central** (grupo `net.sf.jasperreports`,
versão 7.0.7): os cinco artefatos previstos existem, e **dois artefatos adicionais são
necessários** na prática (comprovados pelo harness da Fase 0 e pelo smoke test do serviço):

| Artefato | Papel | Status |
|---|---|---|
| `jasperreports` | core: modelo, load Jackson, compile, fill | ✅ previsto no ADR-007 |
| `jasperreports-pdf` | exportação PDF (`net.sf.jasperreports.pdf.JRPdfExporter`) | ✅ previsto |
| `jasperreports-fonts` | fontes DejaVu embarcadas (acentuação pt-BR) | ✅ previsto |
| `jasperreports-functions` | funções de expressão (`msg(...)` etc.) | ✅ previsto |
| `jasperreports-metadata` | introspecção do modelo (apoia RFC-002) | ✅ previsto |
| `jasperreports-jdt` | **compilador de expressões (JDT)** — sem ele `compileReport` falha em runtime | ➕ adição |
| `jasperreports-barcode4j` | componentes de barcode (QRCode, EAN-13) do subconjunto ReportLenz | ➕ adição |

Evidências:
- HTTP 200 para o `.pom` 7.0.7 de todos os sete artefatos no Central (2026-07-09).
- `MatrizJr7Test` (render-service): load → compile → fill → export produz `%PDF` de verdade —
  quebra se qualquer módulo da matriz faltar.
- `JasperExportManager` continua no core como fachada; o exporter real vive no módulo pdf
  (verificado na árvore de fontes da tag 7.0.7).

## Armadilhas confirmadas (para quem migra do 6.x)

- PDF e fontes **não** vêm no core — a ausência falha só em runtime.
- O compilador de expressões também saiu do core (`jasperreports-jdt`) — ADR-007 não o listava.
- O fill **muta o mapa de parâmetros** (registra o datasource): passar `Map.of()` imutável quebra
  com `UnsupportedOperationException`. Usar mapa mutável no pipeline (RFC-003 §3).

## Stack do serviço

Spring Boot **4.0.7** (linha 4.0.x madura; alinhada ao JDK 25 do ambiente), Java release 21,
starter `spring-boot-starter-webmvc`, porta 8087. Módulo em `render-service/` na raiz do repo.
