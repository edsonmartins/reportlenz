# Tasks — phase-0-extract-jrxml-core

> Entregas session-sized. Marcar `[x]` ao concluir; "done" = critérios de aceite da RFC-001 + gates aplicáveis.

## 1. Setup do pacote
- [x] 1.1 Scaffold `jrxml-core` (TS, build ESM, Vitest, sem deps de UI)
- [x] 1.2 Definir tooling (tsconfig estrito, lint, CI)

## 2. Confirmar dialeto do fork
- [x] 2.1 Inspecionar o fork `jrxml_web_designer`: identificar se o XML emitido é 6.x ou 7.x → **6.x**
- [x] 2.2 Registrar achado em nota de design (impacta quanto do serializer é reaproveitável) → `docs/design/nota-001-dialeto-fork-jrxml-web-designer.md`

## 3. Modelo de domínio (RFC-001 §3)
- [x] 3.1 Tipos: `ReportTemplate`, `BandSet`, `Band`, `Element` (subconjunto fatura/comprovante/form/etiqueta A4)
- [x] 3.2 Tipos de contrato: `DataContract`, `FieldDecl`, `ParamDecl`, `VariableDecl`

## 4. Parser (JRXML 7 → modelo)
- [x] 4.1 Integrar parser XML; mapear bandas e elementos do subconjunto
  - [x] 4.1a Infra (fast-xml-parser, `Result`/`ParseError`), raiz/pageFormat/properties/styles + contrato (field/parameter/variable)
  - [x] 4.1b Bandas/grupos + elementos básicos (staticText, textField, line, rectangle, ellipse, image, frame)
  - [x] 4.1c Componentes (table, barcode) + subreport
- [x] 4.2 Rejeitar dialeto 6.x com erro `LEGACY_DIALECT`
- [x] 4.3 Rejeitar `<queryString>` com `CONTRACT_PULL_FORBIDDEN` (+ `<query>` do dialeto 7 e `<connectionExpression>`)

## 5. Serializer (modelo → JRXML 7)
- [x] 5.1 Emitir XML na ordem de elementos/atributos aceita pela Library 7 (ordem dos samples 7.0.7; prova final na 5.2)
- [ ] 5.2 Validar output contra a Library 7.0.7 (harness Java no CI — ADR-013; não existe XSD oficial)

## 6. Validação
- [ ] 6.1 `validateSchema` (validação estrutural do dialeto 7 — ADR-013)
- [ ] 6.2 `validateContract` (expressões referenciam contrato; anti-Pull)
- [ ] 6.3 Mensagens estruturadas (linha/elemento) p/ o ReportChecker

## 7. Extração de contrato
- [ ] 7.1 `extractContract(template) -> DataContract`

## 8. Round-trip & testes
- [ ] 8.1 Conjunto de JRXMLs 7 de referência (fatura, comprovante, form, etiqueta A4)
- [ ] 8.2 `serialize(parse(x))` valida e é semanticamente equivalente
- [ ] 8.3 Cobertura dos erros de validação (Pull, ref órfã, legado)

## 9. Aceite
- [ ] 9.1 Critérios de aceite da RFC-001 §8 verdes
- [ ] 9.2 Zero dependência de framework de UI no bundle (verificado)
