# ADR-003 — Binding contract-first (Push), proibição de Pull

- **Status:** Accepted
- **Data:** 2026-06-28
- **Relacionado:** I-2, I-3 (Constituição), ADR-001, RFC-002

## Contexto

Há duas filosofias de binding de dados em relatórios:

- **Pull** (JasperReports clássico): o template embute a fonte — `<queryString>` com SQL, conexão JDBC,
  `<field>` amarrados a colunas. O engine resolve os dados na hora do render. Acopla o relatório ao banco
  e fura a camada de domínio.
- **Push** (contrato de dados): o template **declara** o que espera (campos, parâmetros, tipos,
  cardinalidade). O backend satisfaz o contrato — faz os JOINs, chama o ERP, agrega, **aplica o filtro
  LGPD** e entrega um payload já achatado e seguro. O render só preenche.

Todo o ecossistema Jasper é Pull-cêntrico: tanto o Jaspersoft Studio quanto o JasperReports Web Studio
giram em torno de Query Editor, metadata JDBC e Query Preview. **Ninguém no ecossistema faz
contract-first** — é espaço em branco e a tese de diferenciação de ReportLenz.

## Decisão

ReportLenz é **contract-first / Push**, por invariante:

1. `<queryString>` é **proibido** no JRXML e **recusado na validação** (o save falha).
2. `<field>`, `<parameter>` e `<variable>` são tratados como **declaração de contrato**, não como binding
   a banco.
3. O painel de dados do designer pergunta *"quais campos este relatório espera e de que tipo?"*, não
   *"qual query?"*.
4. No backend, o render usa `JRBeanCollectionDataSource` / `Map<String,Object>` montado a partir do
   payload — o Jasper opera em modo Push mesmo sendo nativamente Pull.

A partir da declaração de contrato, o `jrxml-core` gera três artefatos (ver RFC-002):
- o **JSON Schema** do payload (`inputSchema`), validado pelo backend antes de preencher;
- os **tipos TypeScript** para o front (autocomplete do expression editor);
- opcionalmente um **`record` Java** para o backend montar o datasource no formato certo.

## Consequências

- **LGPD preservada por construção** (I-2): o render nunca toca dado na origem; o backend já filtrou.
- O `inputSchema` vira **spec versionável**: mudou o contrato → bump de versão + validação de payload
  (ADR-009).
- Designer e backend evoluem **desacoplados** contra o contrato.
- **Diferenciação real de produto**: um designer JRXML contrato-primeiro não existe no ecossistema.
- **Custo**: exige disciplina para não cair na tentação do Query Editor; o validador precisa recusar
  ativamente JRXML com `<queryString>`. O expression editor depende do contrato para autocomplete e
  validação de nomes referenciados (`$F{x}` inválido se `x` não está no contrato).

## Exceção

Não há exceção dentro do escopo do produto. Casos legados que exijam Pull (relatório que precisa de query
embutida) ficam **fora de escopo** e são endereçados pelo Jaspersoft Studio desktop, não por ReportLenz.
