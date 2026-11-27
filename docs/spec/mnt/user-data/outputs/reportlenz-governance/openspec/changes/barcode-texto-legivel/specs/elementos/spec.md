# Spec: elementos (capability) — texto legível do código de barras

## ADDED Requirements

### Requirement: Posição do texto legível em códigos lineares
O modelo SHALL permitir `textPosition` (`none`, `bottom`, `top`) em códigos de barras lineares e
emiti-lo no dialeto 7 como atributo do `<component>`; ausente, vale o default do engine (embaixo).

#### Scenario: DANFE sem texto sob as barras
- **WHEN** o DANFE é renderizado com a chave de acesso
- **THEN** o CODE-128 continua legível com a chave, a chave aparece formatada em 11 blocos e o número cru
  de 44 dígitos não aparece no PDF

#### Scenario: Round-trip
- **WHEN** um template com `textPosition="none"` é lido e reescrito
- **THEN** o atributo é preservado; um template sem o atributo continua sem ele

#### Scenario: Código 2D
- **WHEN** um QRCode, DataMatrix ou PDF417 declara `textPosition`
- **THEN** a validação acusa `INVALID_ATTRIBUTE`

#### Scenario: Designer
- **WHEN** o usuário seleciona um código linear
- **THEN** o painel oferece "Texto legível" (abaixo, acima, sem texto) e a aproximação do canvas o reflete;
  em código 2D o controle não aparece
