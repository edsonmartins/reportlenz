# Spec: e2e (capability) — E2E de interface e de API no CI

## ADDED Requirements

### Requirement: Fluxos de interface cobertos com identidade real
O E2E SHALL exercitar a SPA contra o ambiente em contêineres com login real no Keycloak, sem tocar os
usuários de homologação.

#### Scenario: Sessão
- **WHEN** um anônimo abre o designer, faz login pelo popup, recarrega e sai
- **THEN** vê "Entrar" sem chamadas à API; após o login vê o usuário, sem nada em web storage; o reload
  reaproveita a sessão SSO; "Sair" volta a "Entrar"

#### Scenario: Preview real
- **WHEN** o designer renderiza o comprovante e a etiqueta A4
- **THEN** a chamada leva Bearer e a imagem do engine aparece sem erro

#### Scenario: Publish por papel
- **WHEN** um designer tenta publicar e um publicador publica o formulário
- **THEN** o designer recebe 403 e o publicador publica, com a auditoria registrando o usuário do token

#### Scenario: G8 na interface
- **WHEN** a fatura é publicada em ambiente onde `fatura_entregas` não está publicado
- **THEN** o G8 aparece vermelho citando `fatura_entregas` e o botão de publicar fica desabilitado

### Requirement: E2E no CI
O CI SHALL subir o ambiente de homologação e rodar os E2E de API e de interface a cada PR.

#### Scenario: Falha no E2E
- **WHEN** algum E2E falha
- **THEN** o job falha e publica relatório do Playwright (traces) e logs do compose
