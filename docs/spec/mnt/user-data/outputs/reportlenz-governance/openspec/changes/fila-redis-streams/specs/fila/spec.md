# Spec: fila (capability) — at-least-once com Redis Streams

## ADDED Requirements

### Requirement: Job só sai da fila depois de processado
A fila SHALL confirmar (XACK) uma mensagem somente APÓS o processamento do job; worker que morre com
mensagem em mãos a deixa pendente para outra instância.

#### Scenario: Worker morre com job em mãos
- **WHEN** um consumidor lê um job e morre sem confirmar
- **THEN** outra instância reivindica a mesma mensagem após o tempo de idle e processa o job

#### Scenario: Reprocessamento não duplica saídas
- **WHEN** um job reentregue é processado por outra instância
- **THEN** itens já registrados são pulados (idempotência por PK job_id+idx)

### Requirement: Mensagem venenosa não trava a fila
Mensagem reentregue acima do limite de entregas SHALL ser confirmada com o job marcado `failed`.

#### Scenario: Limite de entregas excedido
- **WHEN** a mesma mensagem é reivindicada além do limite configurado
- **THEN** ela é confirmada (sai da fila) e o job vira `failed` com log
