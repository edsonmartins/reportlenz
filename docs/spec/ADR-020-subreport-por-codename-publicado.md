# ADR-020 — Subreport por codename publicado (`"repo:<codename>[@versão]"`)

- **Status:** Accepted (pedido do usuário em 2026-11-26)
- **Data:** 2026-11-26
- **Relacionado:** ADR-003 (Push), ADR-008 (compile cache), ADR-009 (versionamento), ADR-016 §2
  (subreport por localização recusado; este ADR completa o "change futuro" previsto lá), RFC-006 (governança)
- **Implementa:** `openspec/changes/subreport-por-codename`

## Contexto

Desde o ADR-016, subreport por localização (arquivo/URL/classpath) é recusado no fill: era desserialização
Java de arquivo apontado pelo payload. O elemento subreport do designer (`templateExpression`, default
`$P{sub_template}`) e a referência "Fatura" ficaram sem caminho funcional — hoje a fatura só renderiza
porque o subreport tem `printWhenExpression` falso sem `entregas`.

## Decisão

1. **Sintaxe:** a expressão do subreport é um **literal de string** `"repo:<codename>"` (versão
   `published` atual do template) ou `"repo:<codename>@<n>"` (versão fixa; aceita `published` ou
   `deprecated`, ambas imutáveis). Codename: `[A-Za-z0-9_.-]+`.
2. **Só literal (G7 estrutural):** qualquer outra expressão de subreport → `EXPRESSAO_PROIBIDA`. O payload
   não escolhe qual template incluir, e o grafo de dependências é estático — analisável antes do render.
3. **Resolução no fill:** a `PoliticaDeRecursos` (ADR-016) resolve `repo:` pelo registro de templates e
   devolve o `JasperReport` compilado **pelo mesmo compilador com cache** (sha256, ADR-008) — o
   subreport passa por anti-Pull e G7 como qualquer template. Qualquer outra localização segue recusada.
4. **Gate G8 — Referências de subreport (publish):** toda referência resolve (existe e tem versão válida)
   e o grafo, seguido pelas versões publicadas, **não volta ao codename sendo publicado** (sem ciclos).
   Como só o publish muda arestas do grafo, o invariante "grafo publicado acíclico" se mantém.
5. **Preview:** referência não resolvível → 400 `SUBREPORT_INDISPONIVEL` antes do fill.
6. **Design-time (jrxml-core):** `validateContract` aponta `SUBREPORT_REF_INVALID` quando a expressão não
   é o literal `repo:` — o ReportChecker mostra antes do preview. A paleta insere `"repo:codename_publicado"`.
7. **Referências:** a "Fatura" passa a usar `"repo:fatura_entregas"`; nova referência `fatura_entregas`
   (subreport das entregas, parâmetro `cliente`).

## Alternativas consideradas

- **`$P{...}` resolvido em runtime:** o payload escolheria o template e ciclos só apareceriam no fill
  (recursão sem fim); rejeitado.
- **Embutir o JRXML do filho no do pai:** duplica conteúdo e perde o versionamento independente.
- **Validar compatibilidade de contrato pai × filho:** desejável, fica para depois — o filho recebe
  `dataSourceExpression` e `parameters` declarados no pai; incompatibilidade aparece no preview.

## Consequências

- Publicar um template com subreport exige o filho publicado antes.
- `"repo:x"` acompanha a versão publicada atual de `x`; para congelar o layout, use `@n`.
- Deprecar a única versão publicada de um filho referenciado sem versão faz os lotes do pai falharem por
  item (registrado como falha), até um novo publish do filho.
