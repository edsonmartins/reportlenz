# Nota de design 001 — Dialeto do fork `jrxml_web_designer`

- **Data:** 2026-07-07
- **Tarefas:** phase-0/2.1, phase-0/2.2
- **Relacionado:** ADR-002 (target JRXML 7.0.7), ADR-004 (caveat da extração), RFC-001 §7, CLAUDE.md §8.1
- **Fork inspecionado:** `https://github.com/fengyunhe/jrxml_web_designer.git` (clone local em
  `~/desenvolvimento/jrxml_web_designer`, projeto `pdf_template_designer` v0.4.6, Vue 3 + Naive UI)

## Veredito

**O fork emite e consome dialeto JRXML 6.x.** Conforme o caveat do ADR-004, o **serializer do
`jrxml-core` será majoritariamente novo**; o parser do fork também mira 6.x e, portanto, **não serve de
molde direto para o parse de JRXML 7** — o reaproveitamento é conceitual (taxonomia, listas de
atributos, casos de borda), não de código.

## Evidências

1. **Serializer emite raiz 6.x** — `src/utils/jrxml/xmlBuilder.ts:66-70` hardcoda:
   `xsi:schemaLocation="http://jasperreports.sourceforge.net/jasperreports http://jasperreports.sourceforge.net/xsd/jasperreport.xsd"`
   (o `jasperreport.xsd` singular é o esquema do trilho 6.x).
2. **Elementos no formato aninhado 6.x** — `src/utils/jrxmlGenerator.ts:855-856` emite
   `<staticText><reportElement ...>` (estrutura clássica 6.x). O JR7 substituiu isso pelo formato
   unificado `<element kind="staticText" ...>` (migração Digester→Jackson, ADR-002).
3. **XSD embarcado é 6.x** — `jasperreport.xsd` (298 KB) na raiz do fork declara `jr:reportFont` e
   `jr:queryString` no elemento raiz — construções do esquema 6.
4. **Fixtures de teste são 6.x** — ex.: `tests/table_with_2_head_rows.jrxml`:
   *"Created with Jaspersoft Studio version 6.21.5.final using JasperReports Library version 6.21.5"*,
   contendo `<queryString>` (inclusive vazio, em `subDataset`).
5. **Submódulo revelador** — `.gitmodules` aponta `jasperreport6Fork` (fork da Library 6 do mesmo autor).
6. **Componente table 6.x** — `jrxmlGenerator.ts:2583` emite `<jr:table>` com
   `components.xsd` no namespace de componentes 6.x.

## Dimensão do código inspecionado

| Arquivo | Linhas | Papel |
|---|---|---|
| `src/utils/jrxmlGenerator.ts` | 3.336 | serializer (modelo → JRXML 6.x) |
| `src/utils/jrxml/parse.ts` | 2.488 | parser (JRXML 6.x → modelo) |
| `src/utils/jrxml/xmlBuilder.ts` | 72 | cabeçalho/raiz do documento |
| `src/utils/jrxml/types.ts` | 89 | tipos do modelo |

## Consequências para a Fase 0

- **Serializer (tarefas 5.x): escrever do zero** mirando o esquema 7.0.7. O `jrxmlGenerator.ts` do fork
  vale como *checklist* de atributos/elementos/casos de borda (ex.: quais atributos são omitidos quando
  iguais ao default), não como código a portar.
- **Parser (tarefas 4.x): também novo**, porque a entrada canônica é JRXML 7 (o formato de elementos
  mudou estruturalmente — `<element kind>` vs elementos nomeados aninhados). Nuance em relação ao
  caveat do ADR-004, que estimava "o parser pode aproveitar mais": isso valeria se aceitássemos entrada
  6.x, o que o ADR-002 proíbe (`LEGACY_DIALECT`).
- **Detecção de 6.x para `LEGACY_DIALECT` (tarefa 4.2):** os marcadores confirmados aqui servem de
  heurística — `schemaLocation` com `jasperreport.xsd` (singular), presença de `<reportElement>`
  aninhado, `<reportFont>`, comentário "Created with Jaspersoft Studio 6.x".
- **O que ainda é reaproveitável do fork:**
  - taxonomia de bandas/elementos e listas de atributos (informam o modelo de domínio, tarefa 3.x);
  - fixtures 6.x de `tests/` como **casos negativos** da suíte (devem falhar com `LEGACY_DIALECT`);
  - abordagem de validação XSD via `xerces-wasm`/`uss-xsd-engine` (candidata para `validateSchema`,
    tarefa 6.1 — validar se roda headless em Node antes de adotar).
- **Pendência aberta (não bloqueia 3.x):** obter o `jasperreports.xsd` oficial da **7.0.7** e fixá-lo no
  repo como referência do serializer/validador (necessário nas tarefas 5.2 e 6.1). Os marcadores exatos
  do dialeto 7 (raiz/namespace) devem ser confirmados contra esse XSD, não assumidos.

## Registro no processo

Resolve a verificação pendente §8.1 do CLAUDE.md. O ADR-004 permanece válido — seu caveat previa
exatamente este cenário; apenas a expectativa de reaproveitamento do parser é rebaixada (ver acima).
