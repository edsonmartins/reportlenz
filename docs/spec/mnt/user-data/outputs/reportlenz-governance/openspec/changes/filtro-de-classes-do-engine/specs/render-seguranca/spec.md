# Spec: render-seguranca — filtro de classes do engine (ADR-021)

## ADDED Requirements

### Requirement: Segunda barreira no fill
O fill SHALL rodar com o filtro de classes do engine ligado; código de expressão que use classe fora da
whitelist falha no render, mesmo que o relatório não tenha passado pelo G7.

#### Scenario: Compile cache envenenado
- **WHEN** o cache entrega um `JasperReport` compilado sem G7 com `Runtime.getRuntime()` numa expressão
- **THEN** o fill falha com "Class java.lang.Runtime is not visible to reports" e nada executa

#### Scenario: Bypass do G7
- **WHEN** um relatório com `new java.io.File(...)` é compilado direto pelo engine e preenchido pelo pipeline
- **THEN** o fill falha sem tocar o filesystem

### Requirement: Paridade com o vocabulário do G7
Todo item do vocabulário legítimo aceito pelo G7 SHALL renderizar com o filtro ligado.

#### Scenario: Vocabulário legítimo
- **WHEN** as expressões legítimas do G7 (BigDecimal/RoundingMode, DATEFORMAT, TEXT, java.time, ternário) e
  os templates de referência são renderizados
- **THEN** todos renderizam
