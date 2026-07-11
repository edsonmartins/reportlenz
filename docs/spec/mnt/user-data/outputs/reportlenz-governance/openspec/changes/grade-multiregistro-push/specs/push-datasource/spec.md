# Spec: push-datasource (capability) — grade multi-registro em modo Push

## ADDED Requirements

### Requirement: Coleção do contrato alimenta o datasource-mestre
Um template MAY declarar a property `reportlenz.datasource.campo` apontando um field `collection` do
contrato; nesse caso o render SHALL montar o datasource-mestre com um registro por ITEM da coleção, e os
`<field>` mestre do JRXML SHALL ser os itemFields da coleção.

#### Scenario: Grade de etiquetas de ponta a ponta
- **WHEN** um template 3 colunas declara `reportlenz.datasource.campo=etiquetas` e o payload traz
  `etiquetas` com 9 itens
- **THEN** o PDF dispõe as 9 etiquetas em grade na folha A4 (uma linha do mestre por item)

#### Scenario: Payload sem a coleção
- **WHEN** o payload não traz a coleção declarada (ou ela é vazia)
- **THEN** o render produz a banda `noData` (quando declarada) sem erro de pipeline

### Requirement: Escopo de validação segue a coleção
Com a property ativa, `validateContract` SHALL validar as expressões `$F{}` das bandas contra os
itemFields da coleção (mais builtins/params/vars), e o contrato SHALL admitir somente essa coleção como
field (demais valores de topo são parameters).

#### Scenario: Item referenciado é válido
- **WHEN** uma banda usa `$F{preco}` e `preco` é itemField da coleção-datasource
- **THEN** a validação passa (sem `EXPR_UNKNOWN_REF`)

#### Scenario: Field escalar de topo é rejeitado
- **WHEN** o contrato declara um field escalar de topo além da coleção-datasource
- **THEN** a validação acusa orientando movê-lo para parameter

### Requirement: Round-trip e extração preservam o arranjo
`serializeJrxml`/`parseJrxml`/`extractContract` SHALL preservar a property e reconstruir o contrato
(coleção + itemFields) a partir do JRXML.

#### Scenario: Round-trip
- **WHEN** um template com a property é serializado e re-parseado
- **THEN** o modelo resultante é semanticamente igual (property, contrato e bandas intactos)

### Requirement: Designer expõe a fonte de linhas
A UI SHALL oferecer, na aba Página, a escolha da fonte de linhas (registro único ou um campo-coleção do
contrato), e o preview SHALL usar N itens de amostra quando uma coleção está selecionada.

#### Scenario: Preview em grade
- **WHEN** o usuário seleciona a coleção `etiquetas` como fonte de linhas e abre o preview
- **THEN** o PNG mostra a grade com múltiplas etiquetas (não uma só)
