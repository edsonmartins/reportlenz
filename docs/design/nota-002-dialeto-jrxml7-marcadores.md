# Nota de design 002 — Marcadores do dialeto JRXML 7 (observados na 7.0.7 real)

- **Data:** 2026-07-08
- **Tarefas:** subsidia phase-0/4.x (parser), 5.x (serializer) e 6.x (validação)
- **Fontes:** árvore de fontes da tag `7.0.7` de github.com/TIBCOSoftware/jasperreports —
  `demo/samples/jasper/reports/FirstJasper.jrxml`, `demo/samples/table/reports/TableReport.jrxml`
  (dialeto emitido/consumido pela própria Library 7.0.7)

## Estrutura do dialeto 7

1. **Raiz sem namespace/schemaLocation:**
   `<jasperReport name="..." columnCount="2" pageWidth="595" ... uuid="...">` — sem `xmlns`, sem
   `xsi:schemaLocation`, sem atributo `language` de compilador na raiz.
2. **Elementos unificados:** todo elemento de banda é `<element kind="staticText|textField|line|rectangle|ellipse|image|component|..." uuid="..." x=".." y=".." width=".." height=".." ...>`
   — os atributos de posição/estilo ficam **direto no `<element>`** (não existe mais `<reportElement>`
   aninhado do 6.x).
3. **Filhos por kind:** `<text>` (staticText), `<expression>` (textField), `<property>`,
   `<patternExpression>`; `pattern`, `hTextAlign`, `vTextAlign`, `blankWhenNull`, `evaluationTime`
   são **atributos**.
4. **Query:** `<query language="sql"><![CDATA[...]]></query>` — **substitui** o `<queryString>` do 6.x.
   ⚠️ Anti-Pull (tarefa 4.3): rejeitar **ambas** as formas — `<query>` (dialeto 7) e `<queryString>`
   (marcador de legado, já coberto por `LEGACY_DIALECT`, mas a recusa Pull tem precedência semântica).
5. **Declarações de contrato:** `<parameter name class/>`, `<field name class/>`,
   `<variable name resetType calculation resetGroup class><expression>...</variable>` — expressão como
   filho `<expression>` (não `<variableExpression>` do 6.x).
6. **Estilos:** `<style name default fontName fontSize bold italic underline strikeThrough .../>`;
   `<conditionalStyle forecolor="#FF0000" bold="true"><conditionExpression>` — as propriedades
   condicionais são **atributos diretos** do `<conditionalStyle>` (no 6.x havia `<style>` aninhado).
   Herança via atributo `style="NomeDoPai"`.
7. **Seções:** as de banda única (`<title>`, `<pageHeader>`, `<columnHeader>`, `<columnFooter>`,
   `<pageFooter>`, `<summary>`, `<background>`, `<noData>`) **são a própria banda** — height/splitType
   direto na tag (`<title height="60">`); `<band>` aninhado é rejeitado pelo load
   (`UnrecognizedPropertyException: "band"`, confirmado pelo harness em 2026-07-08). Apenas `<detail>`
   e `<groupHeader>/<groupFooter>` envelopam `<band height="..">`. Grupos:
   `<group name><expression>` + header/footer.
8. **Tabela:** `<element kind="component"><component kind="table"><datasetRun subDataset="..."><dataSourceExpression>` + `<column kind="single" width="..."><columnHeader .../><detailCell .../>`.
   No ReportLenz o `dataSourceExpression` referencia a coleção do contrato (Push) — nunca datasetRun
   com query no subDataset.
9. **Números fracionários:** `fontSize="8.0"` (decimal), coordenadas inteiras.

## Heurística `LEGACY_DIALECT` (tarefa 4.2) — marcadores 6.x

- `xsi:schemaLocation` apontando `.../xsd/jasperreport.xsd` (singular) ou `xmlns` do sourceforge na raiz.
- Presença de `<reportElement>` (formato aninhado 6.x).
- `<queryString>`, `<reportFont>`, `<variableExpression>`, `<groupExpression>`,
  `<conditionalStyle><style .../></conditionalStyle>` aninhado.
- Comentário "Created with Jaspersoft Studio 6.x".

## Fixtures

- Os samples 7.0.7 do repo oficial usam `<query language="sql">` (Pull) — servem como **casos negativos**
  de `CONTRACT_PULL_FORBIDDEN` em dialeto 7 correto.
- Os fixtures Push de referência (fatura/comprovante/formulário/etiqueta A4, tarefa 8.1) serão autorados
  por nós no dialeto 7, sem `<query>`.
- Clones de consulta: fontes da JasperReports Library em `~/desenvolvimento/jasperreports`
  (usar a tag `7.0.7`); fork 6.x em `~/desenvolvimento/jrxml_web_designer`.
