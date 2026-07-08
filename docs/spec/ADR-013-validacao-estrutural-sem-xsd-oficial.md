# ADR-013 — Validação estrutural do JRXML 7 sem XSD oficial (estratégia híbrida)

- **Status:** Accepted
- **Data:** 2026-07-08
- **Relacionado:** ADR-002, RFC-001 §6, CLAUDE.md §7 (gate G1), nota de design 002
- **Supersede parcialmente:** a redação de G1/`validateSchema` em RFC-001 e CLAUDE.md ("validar contra
  `jasperreports.xsd` 7.0.7")

## Contexto

As specs assumiam a existência de um `jasperreports.xsd` oficial da 7.0.7 (gate G1, tarefas 5.2/6.1).
A verificação empírica de 2026-07-08 mostrou que **esse XSD não existe**:

- O JAR `jasperreports-7.0.7` (Maven Central) não contém nenhum `.xsd`/`.dtd`.
- A árvore de fontes da tag `7.0.7` (github.com/TIBCOSoftware/jasperreports) tem **zero** arquivos `.xsd`.
- No JR7 (migração Digester→Jackson XML, ADR-002), a "validação de esquema" passou a ser o próprio
  load/desserialização Jackson da Library — não há mais artefato de esquema publicado. O
  `jasperreport.xsd` que existe online é o do trilho 6.x.
- **Atenção à pegadinha:** `https://jasperreports.sourceforge.net/xsd/jasperreport.xsd` responde 200 e
  parece "o XSD oficial", mas é o esquema **6.x**: declara `jr:reportFont`/`queryString`/`reportElement`,
  não tem o atributo `kind`, e usa `targetNamespace` qualificado — enquanto o JRXML 7 não tem namespace.
  Prova empírica (2026-07-08): `xmllint --schema` contra o `FirstJasper.jrxml` oficial da 7.0.7 falha com
  *"No matching global declaration available for the validation root"*. Não usar esse XSD como referência
  de validação do ReportLenz.

Validar "contra o XSD 7" é, portanto, impossível ao pé da letra. A alternativa de autorar um XSD próprio
foi descartada: caro, sujeito a drift em relação à Library e sem autoridade oficial.

## Decisão

**Estratégia híbrida**, escolhida pelo usuário em 2026-07-08:

1. **`validateSchema` (jrxml-core, TS)** vira **validação estrutural do dialeto 7**: regras derivadas do
   dialeto real observado (nota de design 002) — elemento raiz, formato `<element kind>`, atributos e
   filhos permitidos no subconjunto, tipos de valor. Dá feedback rápido e localizado no designer, sem
   ida ao backend. Continua reportando mensagens estruturadas (linha/elemento) para o ReportChecker.
2. **Gate de verdade no CI (Java)**: um harness Java mínimo que carrega cada JRXML de referência com o
   `JRXmlLoader`/load da **Library 7.0.7** real. A Library é a autoridade final sobre "JRXML válido" —
   coerente com I-8 (a verdade é o engine, não a aproximação).

Redefinição do **gate G1**: *"JRXML aceito pelo load da JasperReports Library 7.0.7 (harness CI); a
validação estrutural TS do `jrxml-core` é a aproximação de design-time"*.

## Consequências

- RFC-001 §5/§6 e CLAUDE.md §7/G1 passam a ser lidos com esta redação; tarefas 5.2 e 6.1 do
  `tasks.md` da Fase 0 idem.
- O harness Java entra como infraestrutura de teste da Fase 0 (antecipa um pedaço da Fase 1 — é o mesmo
  load que o serviço de render usará), rodando no CI ao lado do Vitest.
- A validação TS é **best-effort declarado**: nunca é apresentada como veredito final (I-8); divergência
  entre ela e o load da Library é bug a corrigir na validação TS.
- O risco de drift entre regras TS e Library é controlado pelo harness: todo JRXML que o serializer
  emite nos testes passa pelos dois caminhos.
