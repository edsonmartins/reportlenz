# ADR-008 — Preview round-trip + compile cache

- **Status:** Accepted
- **Data:** 2026-06-28
- **Relacionado:** I-8 (Constituição), ADR-001, RFC-003

## Contexto

No Caminho A (ADR-001) o designer gera JRXML mas **não renderiza** — quem renderiza é a JasperReports
Library em Java. O que se desenha no browser é sempre uma aproximação; o output verdadeiro só aparece
depois que o engine roda. A fidelidade pixel-perfect (que um designer baseado em pdfme teria de graça) não
existe aqui. É o calcanhar declarado do Caminho A.

## Decisão

Preview de **duas velocidades**, honesto (I-8):

### 1. Aproximação instantânea (browser)
Enquanto o usuário edita, o canvas desenha sua melhor interpretação do layout (posição, fonte, borda). É
rápido, mas **rotulado como aproximação** — não é a verdade do Jasper.

### 2. Render real sob demanda (round-trip)
Um botão **"Renderizar (Jasper)"** faz round-trip a um endpoint no Spring Boot:
- recebe o **JRXML** + um **JSON de dados de exemplo** (que satisfaz o contrato);
- roda `JasperCompileManager` → `JasperFillManager` → `JasperExportManager`;
- devolve **PDF** (ou PNG por página) que o designer exibe num painel lado a lado.

É a verdade absoluta — **o mesmo engine da produção**.

### Compile cache
A latência do round-trip é dominada pela **compilação** do `.jrxml`. Mitigação: cachear o relatório
compilado (`.jasper`) por **hash do JRXML** — recompila só quando o template muda, não a cada preview com
dados diferentes. Cache em memória/Redis no serviço de render.

## Consequências

- Resolve o "não sei como vai ficar" sem mentir para o usuário.
- **O endpoint de preview é o mesmo serviço do batch** (ADR-001): não é trabalho jogado fora — é a
  fundação do render de produção.
- Com compile cache, o preview com dados variados fica fluido (recompila só on-change do template).
- **Custo**: latência de rede + compile no primeiro render de cada versão. Aceitável e mitigado pelo cache.

## Detalhes de contrato

Ver RFC-003 para o contrato do endpoint (`POST /render/preview`), formato do payload de exemplo, política
de cache (chave = `sha256(jrxml)`), e o endpoint de batch assíncrono (`POST /render/batch`).
