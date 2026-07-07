# Tasks — phase-0-extract-jrxml-core

> Entregas session-sized. Marcar `[x]` ao concluir; "done" = critérios de aceite da RFC-001 + gates aplicáveis.

## 1. Setup do pacote
- [x] 1.1 Scaffold `jrxml-core` (TS, build ESM, Vitest, sem deps de UI)
- [x] 1.2 Definir tooling (tsconfig estrito, lint, CI)

## 2. Confirmar dialeto do fork
- [ ] 2.1 Inspecionar o fork `jrxml_web_designer`: identificar se o XML emitido é 6.x ou 7.x
- [ ] 2.2 Registrar achado em nota de design (impacta quanto do serializer é reaproveitável)

## 3. Modelo de domínio (RFC-001 §3)
- [ ] 3.1 Tipos: `ReportTemplate`, `BandSet`, `Band`, `Element` (subconjunto fatura/comprovante/form/etiqueta A4)
- [ ] 3.2 Tipos de contrato: `DataContract`, `FieldDecl`, `ParamDecl`, `VariableDecl`

## 4. Parser (JRXML 7 → modelo)
- [ ] 4.1 Integrar parser XML; mapear bandas e elementos do subconjunto
- [ ] 4.2 Rejeitar dialeto 6.x com erro `LEGACY_DIALECT`
- [ ] 4.3 Rejeitar `<queryString>` com `CONTRACT_PULL_FORBIDDEN`

## 5. Serializer (modelo → JRXML 7)
- [ ] 5.1 Emitir XML na ordem de elementos/atributos aceita pela Library 7
- [ ] 5.2 Validar output contra `jasperreports.xsd` 7.0.7

## 6. Validação
- [ ] 6.1 `validateSchema` (XSD 7)
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
