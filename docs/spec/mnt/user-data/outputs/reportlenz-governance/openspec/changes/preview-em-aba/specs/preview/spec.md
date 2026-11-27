# Spec: preview (capability) — render do engine em aba própria

## MODIFIED Requirements

### Requirement: Preview real do engine
O designer SHALL mostrar o render real do engine numa aba **Preview (Jasper)** em tela cheia, separada da
aba **Editor**, preservando o rótulo de aproximação do canvas (I-8).

#### Scenario: Renderizar a partir do editor
- **WHEN** o usuário clica em "Renderizar (Jasper)" na aba Editor
- **THEN** a aba Preview é ativada e mostra o render do documento atual com o selo "verdade do engine"

#### Scenario: Página legível
- **WHEN** o preview abre
- **THEN** a página ocupa a largura útil da aba ("Ajustar à largura"), e o usuário pode escolher página
  inteira ou 50–200%

#### Scenario: Documento mudou depois do render
- **WHEN** o usuário edita o documento e volta à aba Preview
- **THEN** o preview indica que estava desatualizado e renderiza de novo sem clique

#### Scenario: Estado do editor preservado
- **WHEN** o usuário alterna entre as abas
- **THEN** a seleção, o zoom do canvas e o documento continuam como estavam
