# Spec: data-contract (capability)

## ADDED Requirements

### Requirement: Geração de inputSchema a partir do contrato
O sistema SHALL gerar um `inputSchema` (JSON Schema 2020-12) a partir do `DataContract` extraído do
template (RFC-002), sem qualquer referência a query, conexão ou SQL.

#### Scenario: Contrato com lista
- **WHEN** o contrato declara campos consumidos em uma `detail band`
- **THEN** o `inputSchema` modela esses campos como um `array` de objeto

#### Scenario: Variável calculada
- **WHEN** o contrato declara uma `variable` (sum/count)
- **THEN** a variable NÃO aparece como propriedade do payload no `inputSchema`

### Requirement: Codegen de tipos
O sistema SHALL gerar tipos TypeScript e `record` Java a partir do `inputSchema`.

#### Scenario: Geração de artefatos
- **WHEN** o codegen roda sobre um `inputSchema` válido
- **THEN** produz interfaces TS compiláveis e `record(s)` Java compiláveis

### Requirement: Ausência de Pull no contrato
O contrato SHALL NOT conter caminho de Pull (query/conexão/SQL).

#### Scenario: Tentativa de declarar query
- **WHEN** qualquer fluxo tenta associar uma query ao contrato
- **THEN** a operação é recusada (não há API para isso; contract-first por construção)
