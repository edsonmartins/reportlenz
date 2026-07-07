# Spec: ai-assist (capability)

## ADDED Requirements

### Requirement: Geração de JRXML a partir de linguagem natural
O assistente SHALL gerar um draft de template (JRXML 7) a partir de uma descrição em linguagem natural e
do contrato de dados, usando inferência local por padrão.

#### Scenario: Geração de comprovante
- **WHEN** o usuário descreve um comprovante e fornece o contrato
- **THEN** o assistente produz um draft que valida contra XSD 7 + contrato
- **AND** o draft é editável no canvas (nunca auto-publicado)

#### Scenario: Inferência local por padrão
- **WHEN** o assistente é invocado
- **THEN** nenhum dado (NL, contrato, exemplo) é enviado a serviço de nuvem de terceiros sem consentimento explícito

### Requirement: Geração de expressão a partir de linguagem natural
O assistente SHALL traduzir linguagem natural em expressão JR válida referenciando apenas o contrato.

#### Scenario: Expressão de total
- **WHEN** o usuário descreve "total = quantidade × preço unitário"
- **THEN** o assistente produz uma expressão JR válida usando apenas campos do contrato

### Requirement: IA não fura gates nem contract-first
Toda saída de IA SHALL passar pela validação (XSD + contrato) e SHALL NOT conter `<queryString>`.

#### Scenario: Saída com Pull rejeitada
- **WHEN** uma geração tentasse incluir `<queryString>`
- **THEN** a validação a recusa (`CONTRACT_PULL_FORBIDDEN`) e a saída não é aceita
