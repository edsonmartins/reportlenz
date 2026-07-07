# Spec: template-governance (capability)

## ADDED Requirements

### Requirement: Versionamento conjunto JRXML + contrato
O sistema SHALL versionar o JRXML e o `inputSchema` juntos; qualquer mudança em um deles gera nova versão.

#### Scenario: Mudança de contrato
- **WHEN** um campo é adicionado ao contrato de um template publicado
- **THEN** uma nova versão (draft) é criada, sem alterar a versão published anterior

### Requirement: Gates de governança no publish
O sistema SHALL bloquear o publish se qualquer gate G1–G6 (XSD, anti-Pull, integridade de expressão,
dialeto, contrato presente, hash) falhar.

#### Scenario: Publish com expressão órfã
- **WHEN** o template referencia um campo inexistente no contrato
- **THEN** o publish é bloqueado com `EXPR_UNKNOWN_REF`

#### Scenario: Publish íntegro
- **WHEN** todos os gates G1–G6 estão verdes
- **THEN** o template transita para `published` e fica imutável

### Requirement: Imutabilidade do published e auditoria
Versões `published` SHALL ser imutáveis; ações relevantes SHALL ser auditadas.

#### Scenario: Edição de published
- **WHEN** o usuário edita um template published
- **THEN** uma nova versão draft é criada; a published permanece intacta

#### Scenario: Auditoria de batch
- **WHEN** um lote é renderizado
- **THEN** o evento é registrado em `report_template_audit` (jobId, contagem, idempotencyKey)

### Requirement: Biblioteca de blocos reutilizáveis
O sistema SHALL permitir blocos versionados reutilizáveis cujo mini-contrato é mesclado ao contrato do
template, com detecção de conflito de nomes.

#### Scenario: Inserir bloco com conflito
- **WHEN** um bloco declara um campo já existente no contrato do template com tipo incompatível
- **THEN** o sistema reporta conflito e exige resolução antes de inserir
