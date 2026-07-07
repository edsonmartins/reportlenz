# ADR-011 — Pipeline térmico/etiqueta fora do engine Jasper

- **Status:** Accepted
- **Data:** 2026-06-28
- **Relacionado:** ADR-001, Constituição ("Fora de escopo")

## Contexto

Os cenários originais incluíam etiquetas e recibos térmicos (ZPL/EPL/ESC-POS), além de PDF/A4. A
JasperReports Library **não emite** esses protocolos — ela gera PDF/HTML/XLS/DOCX, não comandos de
impressora térmica. Há ainda uma distinção fundamental: **gerar o comando** (ZPL/ESC-POS) ≠ **entregar na
impressora** (porta 9100 raw / USB / serial), e o browser não fala raw socket com impressora de rede de
forma confiável.

## Decisão

O **engine Jasper cobre PDF/A4** (faturas, comprovantes, formulários, relatórios). A **impressão
térmica/etiqueta é um pipeline separado**, fora do escopo do designer JRXML. ReportLenz não tenta unificar
PDF e térmica num só designer.

### Cobertura de etiqueta dentro do Jasper (limitada)
Para **etiquetas em folha A4** (grade de etiquetas impressas em laser), o layout multi-coluna do Jasper
(print order + columns) resolve. Isso **não** é impressão térmica — é PDF de etiquetas para impressora
comum.

### Pipeline térmico verdadeiro (separado, futuro)
Quando houver necessidade de ZPL/ESC-POS real:
- **Geração do comando**: biblioteca dedicada (ex.: `portakal` — SDK TS multi-linguagem ZPL/EPL/ESC-POS,
  MIT; `bwip-js` para barcodes; `zpl-renderer-js`/Labelary para preview). Roda leve no server.
- **Entrega física**: **agente desktop** no ponto de expedição/PDV (porta 9100 / USB / serial). Server
  **gera** o ZPL; agente **entrega**.

Este pipeline é um **produto/módulo separado**, com seu próprio ADR/RFC quando priorizado. Não é
dependência de ReportLenz.

## Consequências

- ReportLenz fica **focado** no que o Jasper faz bem (PDF corporativo denso).
- Etiqueta A4 (laser) está coberta; etiqueta térmica (ZPL) está explicitamente fora.
- Evita a armadilha de tentar um "designer universal" que nenhum projeto OSS resolve bem num só editor.

## Caveat

Se o requisito de térmica se tornar central, reavaliar se um **segundo designer** (canvas → ZPL, ex.:
Konva + portakal) é necessário — mas como produto irmão, não dentro do designer JRXML.
