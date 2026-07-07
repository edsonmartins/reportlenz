# Spec: designer-ui (capability) — features pro

## MODIFIED Requirements

### Requirement: Expression editor assistido pelo contrato
A UI SHALL oferecer um editor de expressão com autocomplete sobre o contrato e validação de sintaxe e de
nomes referenciados, substituindo a digitação manual sem assistência.

#### Scenario: Autocomplete de campo
- **WHEN** o usuário digita `$F{` no editor de expressão
- **THEN** a UI sugere os fields declarados no contrato

#### Scenario: Referência inválida
- **WHEN** a expressão usa `$F{x}` e `x` não está no contrato
- **THEN** a UI marca erro inline e reporta no ReportChecker (`EXPR_UNKNOWN_REF`)

## ADDED Requirements

### Requirement: Editor de tabela com merge/split
A UI SHALL permitir criar tabelas com add/delete/reorder de colunas e merge/split de células, com binding
de coluna ao contrato.

#### Scenario: Reordenar colunas
- **WHEN** o usuário arrasta o cabeçalho de uma coluna para outra posição
- **THEN** a ordem das colunas é atualizada no modelo e no JRXML

### Requirement: Código de barras
A UI SHALL permitir inserir códigos de barras (Code128, QR) via barcode4j.

#### Scenario: Inserir QR de pedido
- **WHEN** o usuário insere um QR bindado a `$F{pedido.qrPayload}`
- **THEN** o JRXML inclui o componente de barcode correspondente

### Requirement: Estilos condicionais
A UI SHALL suportar `conditionalStyle` e `printWhenExpression`.

#### Scenario: Destacar linha por condição
- **WHEN** uma linha tem `conditionalStyle` baseado em expressão
- **THEN** o estilo é aplicado quando a condição é verdadeira no render

### Requirement: Grupos e subreports
A UI SHALL suportar grupos com subtotais e subreports com contrato próprio.

#### Scenario: Subtotal por grupo
- **WHEN** um relatório agrupa itens e define um subtotal no groupFooter
- **THEN** o render exibe o subtotal por grupo

### Requirement: Padrões pt-BR
A UI SHALL oferecer padrões de formatação pt-BR (R$, milhar com ponto, `dd/MM/yyyy`, `blankWhenNull`).

#### Scenario: Valor monetário
- **WHEN** um campo numérico usa o padrão R$
- **THEN** o render exibe o valor formatado como moeda brasileira, com acentuação correta

### Requirement: Etiquetas A4 multi-coluna (laser)
A UI SHALL suportar layout multi-coluna (print order + columns) para grades de etiquetas em folha A4.

#### Scenario: Grade de etiquetas
- **WHEN** o template define N colunas de etiqueta
- **THEN** o PDF dispõe as etiquetas em grade na folha A4 (saída laser, não térmica)
