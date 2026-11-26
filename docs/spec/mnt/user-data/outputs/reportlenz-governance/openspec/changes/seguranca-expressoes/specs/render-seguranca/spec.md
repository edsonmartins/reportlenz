# Spec: render-seguranca (capability) — sandbox de expressões e recursos

## ADDED Requirements

### Requirement: Expressões só usam o vocabulário permitido (G7)
O serviço SHALL recusar, antes de compilar, qualquer JRXML cuja expressão contenha token, identificador,
membro ou parâmetro de sistema fora da allowlist do ADR-016.

#### Scenario: Execução de comando no servidor
- **WHEN** o preview recebe um JRXML com a expressão `Runtime.getRuntime().exec("id")`
- **THEN** a resposta é 400 `EXPRESSAO_PROIBIDA` nomeando `Runtime`, e nada é compilado nem cacheado

#### Scenario: Conexão JDBC dentro de expressão (Pull disfarçado)
- **WHEN** uma expressão usa `java.sql.DriverManager.getConnection(...)`
- **THEN** a resposta é 400 `EXPRESSAO_PROIBIDA`

#### Scenario: Fuga do método gerado
- **WHEN** uma expressão contém `;`, `{`, `}`, comentário ou escape `\u`
- **THEN** a resposta é 400 `EXPRESSAO_PROIBIDA`

#### Scenario: Parâmetro de sistema perigoso
- **WHEN** uma expressão referencia `$P{REPORT_CLASS_LOADER}` ou `$P{REPORT_CONNECTION}`
- **THEN** a resposta é 400 `EXPRESSAO_PROIBIDA`

#### Scenario: Vocabulário legítimo continua válido
- **WHEN** os templates de referência (fatura, comprovante, formulário, etiqueta A4) e expressões típicas do
  Assistente B (BigDecimal `.add`/`.divide(x, 2, java.math.RoundingMode.HALF_UP)`, ternário,
  concatenação, `DATEFORMAT`, `TEXT`) são renderizados
- **THEN** o render segue normalmente

### Requirement: JRXML não instancia classes arbitrárias
O serviço SHALL recusar `<import>`, scriptlets (relatório ou dataset), `language` diferente de `java`,
`formatFactoryClass`, `incrementerFactoryClass` e `customizerClass`.

#### Scenario: Scriptlet declarado
- **WHEN** o JRXML declara `scriptletClass` ou `<scriptlet>`
- **THEN** a resposta é 400 `EXPRESSAO_PROIBIDA`

### Requirement: Publish bloqueia template inseguro
A verificação de gates SHALL incluir G7; com G7 vermelho o publish é recusado.

#### Scenario: Verificação de publish com expressão proibida
- **WHEN** `POST /publish/verificar` recebe JRXML com expressão fora da allowlist
- **THEN** G7 vem `verde=false` com a violação e o resultado geral é `verde=false`

### Requirement: Recursos não são carregados por localização arbitrária
O fill/export SHALL usar um contexto Jasper que recusa subreport por localização, não lê o filesystem e
só busca URLs com prefixo permitido por configuração.

#### Scenario: Subreport apontando para arquivo
- **WHEN** o payload envia `sub_template` = caminho de um `.jasper`/`.jrxml`
- **THEN** o subreport não é carregado e o render falha com erro de recurso recusado

#### Scenario: Imagem apontando para arquivo local ou URL interna
- **WHEN** a expressão de imagem resolve para `/etc/hosts` ou `http://169.254.169.254/`
- **THEN** o recurso não é lido (imagem em branco com `onErrorType=Blank`, ou erro de render)

#### Scenario: Fontes do engine continuam disponíveis
- **WHEN** um PDF com `R$`, `ç`, `ã` é renderizado no contexto restrito
- **THEN** a fonte DejaVu é embarcada normalmente

### Requirement: Batch só renderiza template publicado
`POST /render/batch` SHALL exigir `templateCodename` com versão `published`.

#### Scenario: Batch com JRXML bruto
- **WHEN** o pedido traz `jrxml` sem `templateCodename`
- **THEN** a resposta é 400 `JRXML_BRUTO_PROIBIDO` e nenhum job é criado
