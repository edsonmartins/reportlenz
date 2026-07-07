# Spec: designer-ui (capability) — base

## ADDED Requirements

### Requirement: Canvas WYSIWYG com interação profissional
A UI SHALL oferecer um canvas que renderiza a página (A4/custom em pt) com snapping, multi-seleção,
alinhamento/distribuição, réguas em mm, grid, z-order, nudge por teclado, copy/paste e undo/redo.

#### Scenario: Snapping ao mover elemento
- **WHEN** o usuário arrasta um elemento próximo a outro
- **THEN** guias de alinhamento aparecem e o elemento se ajusta às bordas/centros

#### Scenario: Undo após mover
- **WHEN** o usuário move um elemento e pressiona Ctrl+Z
- **THEN** o elemento retorna à posição anterior

### Requirement: Painel de propriedades com herança visual
A UI SHALL exibir todos os atributos JR do elemento e distinguir visualmente valor herdado/calculado
(cinza-claro) de valor sobrescrito (preto).

#### Scenario: Propriedade herdada de estilo
- **WHEN** um elemento usa um estilo e não sobrescreve uma propriedade
- **THEN** a propriedade aparece em cinza-claro com o valor herdado

### Requirement: Painel de dados contract-first
A UI SHALL permitir declarar o contrato de dados (fields/params/vars) e SHALL NOT oferecer Query Editor,
conexão JDBC ou Query Preview (ADR-003).

#### Scenario: Declaração de contrato
- **WHEN** o usuário declara campos e tipos no DataContractPanel
- **THEN** o `inputSchema` é gerado pelo `jrxml-core`
- **AND** nenhuma opção de query/conexão é apresentada

### Requirement: Preview honesto de duas velocidades
A UI SHALL exibir uma aproximação no canvas (rotulada como aproximação) e SHALL oferecer "Renderizar
(Jasper)" que mostra o render real do endpoint.

#### Scenario: Render real
- **WHEN** o usuário clica em "Renderizar (Jasper)"
- **THEN** a UI chama `POST /render/preview` e exibe o PDF/PNG real lado a lado
