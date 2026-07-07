# Spec: jrxml-core (capability)

## ADDED Requirements

### Requirement: Parse de JRXML 7 para modelo de domínio
O `jrxml-core` SHALL converter um documento JRXML 7 válido em uma instância de `ReportTemplate`,
preservando bandas, elementos, estilos e o contrato de dados declarado.

#### Scenario: JRXML 7 válido
- **WHEN** `parseJrxml(xml)` recebe um JRXML 7 bem-formado e válido
- **THEN** retorna `ReportTemplate` com bandas e elementos correspondentes
- **AND** popula `dataContract` a partir de `<field>/<parameter>/<variable>`

#### Scenario: JRXML de dialeto 6.x
- **WHEN** `parseJrxml(xml)` recebe um JRXML criado em versão 6 ou anterior
- **THEN** retorna erro `LEGACY_DIALECT` sem produzir modelo

### Requirement: Proibição de Pull no parse
O `jrxml-core` SHALL recusar qualquer JRXML que contenha `<queryString>`, em conformidade com o binding
contract-first (ADR-003).

#### Scenario: JRXML com queryString
- **WHEN** o documento contém um elemento `<queryString>`
- **THEN** a validação retorna `CONTRACT_PULL_FORBIDDEN`
- **AND** o template não é considerado válido para save/publish

### Requirement: Serialização para JRXML 7
O `jrxml-core` SHALL serializar um `ReportTemplate` em JRXML 7 que valida contra o `jasperreports.xsd`
7.0.7.

#### Scenario: Round-trip determinístico
- **WHEN** `serializeJrxml(parseJrxml(x))` é executado sobre um JRXML 7 de referência
- **THEN** o resultado valida contra o XSD 7
- **AND** é semanticamente equivalente ao original

### Requirement: Validação dupla (XSD + contrato)
O `jrxml-core` SHALL oferecer `validateSchema` (contra XSD 7) e `validateContract` (integridade de
expressões + anti-Pull), com mensagens estruturadas.

#### Scenario: Expressão referencia campo inexistente
- **WHEN** uma expressão usa `$F{x}` e `x` não está declarado no contrato
- **THEN** `validateContract` retorna `EXPR_UNKNOWN_REF` com nome e localização

### Requirement: Extração de contrato de dados
O `jrxml-core` SHALL extrair um `DataContract` do modelo, consumível pela geração de `inputSchema` (RFC-002).

#### Scenario: Extração de contrato
- **WHEN** `extractContract(template)` é chamado
- **THEN** retorna `DataContract` com fields, parameters e variables declarados (variables marcadas como
  calculadas, fora do payload)

### Requirement: Independência de framework de UI
O `jrxml-core` SHALL NOT depender de Vue, React ou APIs de DOM.

#### Scenario: Bundle headless
- **WHEN** o pacote é empacotado
- **THEN** o bundle não contém dependências de framework de UI nem de DOM
