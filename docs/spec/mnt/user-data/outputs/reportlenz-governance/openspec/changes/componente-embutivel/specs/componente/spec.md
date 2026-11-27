# Spec: componente (capability) — designer e preview embutíveis

## ADDED Requirements

### Requirement: Componente embutível
O pacote `@reportlenz/designer-react` SHALL exportar `<ReportLenzDesigner>` e `<ReportLenzPreview>`, que
funcionam dentro de uma aplicação React/Mantine com o tema e o provider dela.

#### Scenario: Token da aplicação
- **WHEN** a aplicação passa `getAccessToken` e o usuário renderiza ou publica
- **THEN** cada chamada ao render-service leva `Authorization: Bearer <token>` obtido naquele momento, e
  nada é gravado em web storage

#### Scenario: Duas instâncias na mesma página
- **WHEN** a aplicação renderiza dois `<ReportLenzDesigner>` com templates diferentes
- **THEN** editar um não altera o outro (documento, seleção, preview e abas independentes)

#### Scenario: Modo registro
- **WHEN** o componente recebe `codename` (e opcionalmente `versao`)
- **THEN** abre o template do registro; salvar cria a versão e chama `onSalvo`; publicar passa pelos gates
  G1–G8 e chama `onPublicado`

#### Scenario: Modo controlado
- **WHEN** o componente recebe `template` e `onChange`
- **THEN** abre aquele template e chama `onChange(modelo, jrxml)` a cada mudança, sem gravar no registro

#### Scenario: Preview avulso
- **WHEN** a aplicação usa `<ReportLenzPreview codename payload>`
- **THEN** mostra o render do engine para a versão publicada com aqueles dados, com paginação

#### Scenario: Serviço em outra origem
- **WHEN** `apiBaseUrl` aponta para outra origem listada em `REPORTLENZ_CORS_ORIGENS`
- **THEN** o render-service responde com os cabeçalhos CORS; origem fora da lista é recusada

### Requirement: Pacotes publicáveis
Os pacotes SHALL ser instaláveis do tarball do `npm pack` numa aplicação externa, com tipos, sem
dependências do monorepo e com React/Mantine como peers.

#### Scenario: Aplicação hospedeira de teste
- **WHEN** uma aplicação Vite externa instala os tarballs e embute os componentes
- **THEN** compila, o E2E faz preview real e as duas instâncias funcionam independentes
