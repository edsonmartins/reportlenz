# CLAUDE.md — Guia operacional do ReportLenz para o Claude Code

> **Papel:** você é o agente de engenharia do ReportLenz. Conduz a implementação **contra as
> especificações** deste repositório, em entregas pequenas, respeitando invariantes inegociáveis.
> **Idioma:** todo output (código, comentários, commits, docs) em **português técnico do Brasil**.
> **Uso:** este arquivo é carregado automaticamente pelo Claude Code. Releia a seção relevante antes de
> cada tarefa. Quando em dúvida entre velocidade e conformidade com a spec, **escolha a spec**.

---

## 0. Como usar este arquivo

1. Antes de qualquer trabalho, identifique **em qual fase e tarefa** você está (`openspec/changes/phase-*/tasks.md`).
2. Leia o **proposal + spec** da fase e o **ADR/RFC** referenciados *antes* de escrever código.
3. Implemente **uma tarefa session-sized por vez**. Não agrupe fases.
4. Valide contra os critérios de aceite e os **gates** (§7). Só então marque `[x]` em `tasks.md`.
5. Se precisar desviar de uma decisão registrada, **não desvie silenciosamente** — abra um novo ADR (§9).

---

## 1. O que é ReportLenz

Designer web de templates **JRXML, contract-first**, cujo render roda nativamente em Java pela
**JasperReports Library 7.0.7** embarcada no Spring Boot. Evolui de um fork do `jrxml_web_designer`. O
diferencial é a **recusa do modelo Pull** (SQL embutido no relatório) em favor de um **contrato de dados
declarativo** (Push), preservando LGPD/soberania de dados. Codinome estável: **ReportLenz**.

---

## 2. Fonte de verdade e precedência

A autoridade segue esta ordem. Em conflito, o item mais alto vence:

1. **`CONSTITUTION.md`** — invariantes. Inviolável sem emenda explícita.
2. **ADRs** (`docs/adr/`) — decisões arquiteturais aceitas.
3. **RFCs** (`docs/rfc/`) — specs técnicas detalhadas.
4. **OpenSpec changes** (`openspec/changes/phase-*/`) — `proposal.md`, `tasks.md`, `specs/<cap>/spec.md`.
5. Este `CLAUDE.md` — operacionaliza o acima; nunca o contradiz.

**Nunca** invente requisito que não esteja nessas fontes. Se uma decisão necessária não existe, **pare e
proponha um ADR/RFC** em vez de improvisar no código.

---

## 3. Invariantes invioláveis (os que mordem na implementação)

Estes vêm da Constituição. Violação = trabalho rejeitado, não importa se "funciona".

- **I-3 · Contract-first, nunca Pull.** É **proibido** emitir, aceitar ou gerar JRXML com `<queryString>`.
  Nenhum componente oferece Query Editor, conexão JDBC ou "Query Preview". O painel de dados pergunta
  *"quais campos e tipos?"*, não *"qual query?"*. Toda geração (inclusive IA) que produzisse `<queryString>`
  deve ser recusada com `CONTRACT_PULL_FORBIDDEN`.
- **I-2 · LGPD dura.** Nenhum código de design-time ou de render acessa fonte de dados na origem
  (Consinco/Oracle, J-Control). O render recebe **payload já filtrado** pelo backend de domínio, a montante.
  Não escreva código que conecte o designer ou o serviço de render a um ERP/banco de negócio.
- **I-7 · Núcleo headless.** `jrxml-core` é **TypeScript puro**: sem `import` de Vue, React ou APIs de DOM.
  Se você precisa de DOM/UI, está no pacote errado — vá para `jrxml-designer-react`.
- **Dialeto JRXML 7 (ADR-002).** Parser/serializer miram **JRXML 7** (Library 7.0.7). Construções 6.x são
  rejeitadas (`LEGACY_DIALECT`). Não use exemplos/tutoriais pré-7.0 como molde (pacotes Java mudaram de nome;
  parsers Digester→Jackson XML).
- **Fronteira de licença LGPLv3 (ADR-006).** A JasperReports Library é consumida **como dependência**, em
  uso server-side. **Não modifique** os fontes da Library; **não redistribua** o JAR a terceiros; não derive
  de artefatos da suite comercial (Web Studio/Server/IO). Todo código próprio vive **fora** da Library.
- **I-8 · Preview honesto.** A aproximação no canvas é sempre **rotulada como aproximação**. A verdade é o
  render real via endpoint Jasper. Nunca apresente a aproximação como output final.
- **Térmica fora de escopo (ADR-011).** O engine cobre **PDF/A4**. ZPL/EPL/ESC-POS **não** são deste
  produto. Etiqueta A4 (laser, multi-coluna) é permitida; etiqueta térmica não.

---

## 4. Ordem das fases e estado atual

```
Fase 0  →  Fase 1  →  Fase 2  →  Fase 3  →  Fase 4
core       render+    casca      features    IA +
headless   contrato   React      pro         governança
```

- **Estado atual: Fases 0 a 3 concluídas** (aceites: notas 003, 005, 006 e 007 em `docs/design/`).
  A UI Vue do fork está aposentada (nota 006). Próxima: **Fase 4** (`phase-4-ai-governance`).
- Não avance para uma fase enquanto os critérios de aceite da anterior não estiverem verdes.
- Cada fase depende explicitamente da anterior (ver `proposal.md` de cada change → "Depende de").

---

## 5. Loop de trabalho (spec-driven)

Para **cada** tarefa:

1. **Localize** a tarefa em `tasks.md` da fase atual. Pegue a primeira não concluída em ordem.
2. **Leia** o `spec.md` da capability + o(s) ADR/RFC citados no `proposal.md`.
3. **Planeje** brevemente: que arquivos, que contratos de interface, que cenários do `spec.md` cobre.
4. **Implemente** somente o escopo daquela tarefa. Sem "enquanto estou aqui".
5. **Teste** contra os `#### Scenario:` do `spec.md`. No `jrxml-core`, isso é Vitest; no serviço de render,
   testes Spring; na UI, testes de componente.
6. **Valide os gates** aplicáveis (§7).
7. **Marque** `[x]` na tarefa e descreva no commit o que foi feito e qual cenário/critério satisfaz.
8. Pare. Não emende a próxima tarefa no mesmo passo sem necessidade.

Se uma tarefa for grande demais para uma sessão, **quebre-a** em subtarefas no próprio `tasks.md` antes de
começar (granularidade session-sized é um princípio, não sugestão).

---

## 6. Regras específicas por camada

### `jrxml-core` (Fase 0 · RFC-001)
- Tipos primeiro (modelo de domínio), depois parser, depois serializer, depois validação.
- `serialize(parse(x))` deve **validar contra o XSD 7** e ser semanticamente equivalente (round-trip tests).
- Cubra o **subconjunto** necessário (fatura/comprovante/formulário/etiqueta A4) antes de expandir.
- **Confirme o dialeto do fork** antes de reaproveitar o serializer (ver §8).
- Sem dependência de framework de UI no bundle (verifique no build).

### Serviço de render — Spring Boot (Fase 1 · RFC-003, ADR-007)
- Matriz Maven **modular**: declare explicitamente `jasperreports`, `jasperreports-pdf`,
  `jasperreports-fonts`, `jasperreports-functions`, `jasperreports-metadata` (PDF e fontes **não** vêm no
  core no JR7). Valide a lista exata contra o BOM 7.0.7 (§8).
- Pipeline: resolver versão → **validar payload contra `inputSchema` (422 se inválido)** → compilar
  (compile cache por `sha256(jrxml)`) → montar datasource Push (`JRBeanCollectionDataSource`/`Map`) →
  fill → export PDF.
- `400` se o JRXML contiver `<queryString>` (anti-Pull). `422` se o payload não satisfaz o contrato.
- Batch assíncrono e **idempotente** (chave por job); compile único, fill N.
- OTel em todo o pipeline; separe spans de compile/fill/export.
- Embarque fonte com acentuação pt-BR e teste `R$`, `ç`, `ã` no PDF.

### UI — React/Mantine/Archbase (Fases 2–3 · RFC-004, ADR-005)
- Toda mutação do documento passa pelo `jrxml-core` (validação contínua → ReportChecker).
- **Sem browser storage** (localStorage/sessionStorage); estado em memória (React state/store).
- Painel de propriedades com **herança visual** (cinza-claro herdado / preto sobrescrito).
- `DataContractPanel` **nunca** oferece query/conexão.
- Expression editor: autocomplete sobre o contrato + validação de nomes (`EXPR_UNKNOWN_REF`).
- Preview: aproximação rotulada + botão "Renderizar (Jasper)" → `POST /render/preview`.
- Priorize **snapping** e **tabela com merge/split** cedo (são o que mais dói — roadmap do Web Studio).

### IA (Fase 4 · RFC-005, ADR-010)
- Inferência **local por padrão**; nada de layout/contrato/dados de exemplo para nuvem sem consentimento.
- Saída da IA é **sempre draft editável** e **sempre passa pelos gates** (§7). IA não tem caminho privilegiado.
- ADR-010 só vira `Accepted` após o spike de qualidade (taxa de JRXML 7 válido na primeira geração).

---

## 7. Definition of Done · gates de validação

"**Pass 5 é a única autoridade sobre 'done'**" (I-5). Uma tarefa só está concluída quando:

- [ ] Cobre os `#### Scenario:` relevantes do `spec.md` da capability.
- [ ] **G1 — Dialeto 7 aceito pela Library (ADR-013):** JRXML aceito pelo load da JasperReports Library
  7.0.7 (harness Java no CI); a validação estrutural TS do `jrxml-core` é a aproximação de design-time.
  (Não existe XSD oficial da 7.0.7 — ver ADR-013.)
- [ ] **G2 — Anti-Pull:** sem `<queryString>` em nenhum caminho.
- [ ] **G3 — Integridade de expressão:** toda `$F/$P/$V` referencia o contrato.
- [ ] **G4 — Dialeto:** sem construções 6.x.
- [ ] **G5 — Contrato:** `inputSchema` presente e válido (onde aplicável).
- [ ] **G6 — Hash:** `jrxml_hash` consistente (onde aplicável).
- [ ] Testes verdes (Vitest / Spring / componente).
- [ ] Commit descreve o que satisfaz qual critério.

Publish de template é **bloqueado** se qualquer gate falhar.

---

## 8. Verificações pendentes (faça ANTES de codar a parte afetada)

Ambas as verificações originais foram **resolvidas** — consultar as notas antes de mexer nas áreas:

1. ~~Dialeto do fork `jrxml_web_designer`~~ → **resolvida (2026-07-07):** o fork emite **6.x**; parser E
   serializer do core foram escritos do zero mirando o dialeto 7. Ver `docs/design/nota-001` (achado) e
   `nota-002` (marcadores do dialeto 7 real, incl. seções de banda única sem `<band>` aninhado).
2. ~~Matriz Maven exata da 7.0.7~~ → **resolvida (2026-07-09):** os 5 artefatos do ADR-007 confirmados no
   Central **+ 2 adições necessárias** (`jasperreports-jdt` para compilar expressões e
   `jasperreports-barcode4j` para o subconjunto). Ver `docs/design/nota-004`.

---

## 9. Convenções de processo

- **Desvio de decisão registrada:** se a realidade do código exigir contrariar um ADR/RFC, **não improvise**.
  Abra um novo ADR que supersede o anterior (com contexto/alternativas/consequências) e só então implemente.
  Constituição só muda por emenda explícita (ADR `Constitutional`).
- **Nova capability/feature não trivial:** escreva o `proposal.md` + `spec.md` (formato OpenSpec:
  `## ADDED/MODIFIED Requirements` + `#### Scenario:`) **antes** do código.
- **`tasks.md`:** mantenha-o como verdade do progresso. Marque `[x]` só com gates verdes. Quebre tarefas
  grandes em subtarefas antes de começar.
- **Commits:** mensagem em pt-BR, referenciando a tarefa (`phase-1/3.2`) e o critério satisfeito.
- **Escopo:** uma tarefa por vez. Nada de refactors oportunistas fora do escopo da tarefa atual.

---

## 10. O que NÃO fazer (anti-padrões deste projeto)

- ❌ Adicionar `<queryString>`, Query Editor, conexão JDBC ou Query Preview em qualquer lugar.
- ❌ Conectar designer ou serviço de render a ERP/banco de negócio.
- ❌ Importar Vue/React/DOM dentro do `jrxml-core`.
- ❌ Modificar fontes da JasperReports Library ou redistribuir seu JAR; derivar da suite comercial.
- ❌ Usar exemplos/dialeto JRXML 6.x como molde para o serializer.
- ❌ Usar localStorage/sessionStorage na UI (artifacts/estado em memória).
- ❌ Tratar térmica (ZPL/ESC-POS) como escopo deste produto.
- ❌ Apresentar a aproximação do canvas como se fosse o render final.
- ❌ Avançar de fase com critérios de aceite da anterior pendentes.
- ❌ Inventar requisito sem ADR/RFC; desviar de decisão registrada sem novo ADR.

---

> Em resumo: **leia a spec, implemente o escopo da tarefa, valide os gates, marque a tarefa, pare.**
> O ativo durável é o `jrxml-core` + o contrato; a UI é descartável; o render é o mesmo no preview e na
> produção; e o contrato-primeiro é a razão de existir do produto — proteja-o.
