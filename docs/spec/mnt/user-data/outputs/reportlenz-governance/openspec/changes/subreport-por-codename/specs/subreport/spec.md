# Spec: subreport (capability) — subreport por codename publicado

## ADDED Requirements

### Requirement: Referência literal ao registro
A expressão de um subreport SHALL ser o literal `"repo:<codename>"` ou `"repo:<codename>@<n>"`; qualquer
outra forma é recusada pelo G7 (`EXPRESSAO_PROIBIDA`) e apontada no design-time (`SUBREPORT_REF_INVALID`).

#### Scenario: Subreport escolhido pelo payload
- **WHEN** um JRXML usa `$P{sub_template}` como expressão de subreport
- **THEN** o preview responde 400 `EXPRESSAO_PROIBIDA` e o jrxml-core aponta `SUBREPORT_REF_INVALID`

### Requirement: Resolução pela versão publicada
No fill, `repo:<codename>` SHALL resolver a versão `published` atual e `repo:<codename>@<n>` a versão n
(`published` ou `deprecated`), compiladas pelo compilador com cache (anti-Pull + G7).

#### Scenario: Fatura com entregas
- **WHEN** `fatura_entregas` está publicado e a fatura é renderizada com `entregas` no payload
- **THEN** o PDF contém o conteúdo do subreport para cada entrega

#### Scenario: Versão fixa
- **WHEN** a referência é `repo:x@1` e `x` já tem a versão 2 publicada
- **THEN** o render usa a versão 1

### Requirement: Publish valida o grafo (G8)
O publish SHALL recusar template cujas referências de subreport não resolvem ou formam ciclo.

#### Scenario: Filho não publicado
- **WHEN** a fatura é publicada sem `fatura_entregas` publicado
- **THEN** G8 fica vermelho e o publish é bloqueado

#### Scenario: Ciclo
- **WHEN** A (publicado) referencia B e se tenta publicar B referenciando A
- **THEN** G8 fica vermelho apontando o ciclo

### Requirement: Preview com referência quebrada
O preview SHALL responder 400 `SUBREPORT_INDISPONIVEL` quando uma referência não resolve, sem fill.

#### Scenario: Codename inexistente
- **WHEN** o preview recebe subreport `"repo:nao_existe"`
- **THEN** a resposta é 400 `SUBREPORT_INDISPONIVEL`
