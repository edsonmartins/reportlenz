# Spec: catalogo-de-modelos (capability) — modelos de referência e matriz de testes

## ADDED Requirements

### Requirement: Catálogo de modelos por família
O `jrxml-core` SHALL oferecer modelos de referência contract-first nas famílias fiscais/cobrança,
gerenciais, etiquetas/crachás e cartas/documentos, todos aceitos pelos gates G1–G8.

#### Scenario: Boleto legível
- **WHEN** o boleto é renderizado com `codigo_barras` de 44 dígitos e `linha_digitavel` vindos do payload
- **THEN** o PDF traz recibo do pagador e ficha de compensação, e o Interleaved 2 of 5 decodificado do PNG
  é exatamente o `codigo_barras` recebido

#### Scenario: DANFE com chave legível e produtos em várias folhas
- **WHEN** o DANFE é renderizado com a chave de acesso de 44 dígitos e centenas de produtos
- **THEN** o CODE-128 decodificado é a chave, a chave aparece em 11 blocos de 4 dígitos, o cabeçalho do
  emitente se repete em cada folha e todos os produtos aparecem

#### Scenario: Cálculos ficam a montante
- **WHEN** um modelo fiscal/bancário é inspecionado
- **THEN** nenhum DV, fator de vencimento ou chave é calculado no template — chegam prontos no payload

#### Scenario: Relatório gerencial em paisagem
- **WHEN** a listagem de vendas é renderizada com vendas de vários vendedores
- **THEN** a página é A4 paisagem, cada vendedor tem subtotal e o total geral confere com a soma

#### Scenario: Documento multipágina
- **WHEN** o contrato é renderizado com muitas cláusulas longas
- **THEN** ocupa várias folhas com cabeçalho e rodapé em todas e as assinaturas depois da última cláusula

### Requirement: Cenários declarativos e matriz de testes
Cada modelo SHALL declarar cenários (`tipico`, `minimo` e, quando couber, `volume` e `textos_longos`)
com expectativas, e todas as camadas SHALL percorrer o catálogo inteiro sem teste por modelo.

#### Scenario: Modelo novo entra na matriz
- **WHEN** um modelo é registrado em `REFERENCE_TEMPLATES` com cenários
- **THEN** core, engine, harness, E2E e regressão visual passam a testá-lo sem novo código de teste

#### Scenario: Cenário inválido para o contrato
- **WHEN** o payload de um cenário não satisfaz o `inputSchema` do modelo
- **THEN** a matriz do core e a do engine falham apontando modelo e cenário

### Requirement: Regressão visual do render real
O E2E SHALL comparar o PNG do preview de cada modelo da galeria com uma imagem de referência versionada.

#### Scenario: Mudança de layout
- **WHEN** o render de um modelo difere da imagem de referência além da tolerância
- **THEN** o E2E falha e o relatório traz a imagem esperada, a obtida e o diff

### Requirement: Preview realista dos modelos do catálogo
O designer SHALL usar o cenário `tipico` do modelo como dados do preview enquanto o contrato do documento
for o do modelo de referência.

#### Scenario: Modelo intacto
- **WHEN** o usuário abre um modelo da galeria e renderiza
- **THEN** o preview usa os dados do cenário típico (ex.: DANFE com chave válida)

#### Scenario: Contrato alterado
- **WHEN** o usuário altera o contrato do modelo e renderiza
- **THEN** o preview usa dados genéricos gerados do contrato novo
