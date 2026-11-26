# ADR-016 — Sandbox de expressões e de recursos no render (allowlist léxica + repositório restrito)

- **Status:** Accepted (decisão do usuário em 2026-11-26, auditoria de homologação)
- **Data:** 2026-11-26
- **Relacionado:** I-2, I-3 (CONSTITUTION), ADR-003 (contract-first), ADR-008 (compile cache), ADR-013 (gates),
  RFC-003 §4, RFC-006 §3
- **Implementa:** `openspec/changes/seguranca-expressoes`

## Contexto

A auditoria de homologação (2026-11-26) mostrou que o serviço de render executa **código Java arbitrário**
vindo da requisição:

1. Expressões JasperReports são **Java compilado** (JDT) sem sandbox. `POST /render/preview` e
   `POST /render/batch` aceitavam JRXML bruto; uma expressão `Runtime.getRuntime().exec(...)` ou
   `java.sql.DriverManager.getConnection(...)` rodaria no servidor. Este último **contorna o anti-Pull**
   (I-3) e a LGPD (I-2): o gate atual só procura `<query>` e `<connectionExpression>`.
2. O JRXML também instancia classes por nome (`scriptletClass`, `<scriptlet>`, `<import>`,
   `formatFactoryClass`, `incrementerFactoryClass`, `customizerClass`).
3. Recursos são carregados por **localização vinda do payload**: `$P{sub_template}` (subreport) aceita
   um caminho — o engine carrega `.jasper` (desserialização Java) ou `.jrxml` (compilado sem passar pelos
   gates); imagens (`$P{logo_url}`) buscam qualquer URL ou arquivo local (SSRF / leitura de arquivo).
4. O batch com JRXML bruto ignorava os gates G1–G6 e a auditoria de versão (RFC-006).

O Java 21+ não tem mais SecurityManager; o ECJ embarcado pelo `jasperreports-jdt` não traz o AST DOM.

## Decisão

### 1. Allowlist léxica de expressões (novo gate **G7 — Segurança de expressão**)

Toda expressão do relatório (coletadas pelo `JRExpressionCollector` — exatamente as que viram Java) passa
por um verificador léxico ANTES do compile. Referências `$F/$P/$V/$R` são tratadas como operandos opacos
(via chunks da expressão); o restante é tokenizado como Java e só é aceito se:

- **Tokens proibidos ausentes:** `;` `{` `}` `@` `::` `->` `#`, comentários (`//`, `/*`), text blocks
  (`"""`), escapes Unicode (`\u`, que o javac processa ANTES do léxico) e a palavra `class`.
- **Identificadores em allowlist:** tipos permitidos (String, Math, wrappers numéricos, BigDecimal,
  BigInteger, RoundingMode, Locale, Date, java.text formatters, java.time, List/Map/Collection,
  JRBeanCollectionDataSource/JRMapCollectionDataSource/JREmptyDataSource), qualificados ou não; pacotes
  qualificados só dentro de `java.lang|math|text|time(.format|.temporal)|util` e
  `net.sf.jasperreports.engine.data`; palavras-chave `new`, `true`, `false`, `null`, `instanceof`;
  identificadores `MAIÚSCULOS` (funções do `jasperreports-functions` e constantes).
- **Membros (após `.`) em allowlist** de métodos de valor (`equals`, `add`, `format`, `toUpperCase`…)
  ou `MAIÚSCULOS` (constantes). `getClass`, `forName`, `exec`, `invoke`, `loadClass` etc. ficam fora
  por construção.
- **Parâmetros de sistema:** só `REPORT_LOCALE` e `REPORT_TIME_ZONE`; os demais
  (`REPORT_CONNECTION`, `REPORT_CLASS_LOADER`, `REPORT_PARAMETERS_MAP`, `JASPER_REPORTS_CONTEXT`…) são
  recusados.
- Parênteses balanceados.

Estruturais (via `JasperDesign` + marcador textual): sem `<import>`, sem scriptlet (relatório e datasets),
`language` = `java`, sem `formatFactoryClass`, sem `incrementerFactoryClass`, sem `customizerClass`;
nomes de classe de field/parameter/variable precisam ter forma de nome qualificado Java.

Violação → `ErroDeRender.ExpressaoProibida` → **HTTP 400 `EXPRESSAO_PROIBIDA`** no preview e **gate G7
vermelho** no publish (bloqueia).

### 2. Repositório de recursos restrito no fill/export

O fill e o export usam um `JasperReportsContext` próprio cujo PRIMEIRO serviço de repositório é uma
política explícita (`PoliticaDeRecursos`):

- **Subreport por localização é recusado** (qualquer `ReportResource` — `.jasper` seria desserialização
  Java de um arquivo apontado pelo payload). A resolução por codename publicado fica para um change futuro.
- **URL só http(s)** cujo prefixo esteja em `reportlenz.recursos.urls-permitidas` (env
  `REPORTLENZ_RECURSOS_URLS_PERMITIDAS`, lista separada por vírgula; default vazio = nenhuma URL externa).
  Qualquer outro esquema (`file:`, `jar:`, `ftp:`…) é recusado.
- **Caminho sem esquema só se for recurso do engine no classpath** (`net/sf/jasperreports/…`, ex.: fontes
  DejaVu do `jasperreports-fonts`), sem `..`. Caminho absoluto/relativo do filesystem é recusado.
- Recusa → `RECURSO_RECUSADO` (fill falha; imagem com `onErrorType=Blank` sai em branco).

**Achado na implementação:** as propriedades nativas `net.sf.jasperreports.default.file.repository.enabled`
e `net.sf.jasperreports.repository.url.filter.enabled` NÃO bastam — só atuam sobre URLs `file:`; um caminho
absoluto simples (`/etc/hosts`) continuava sendo lido via `resolveFile`. Por isso a política é própria e
coberta por testes com controle (o mesmo recurso carrega no contexto default do engine).

### 3. Batch só com template publicado

`POST /render/batch` exige `templateCodename` com versão `published`; `jrxml` bruto → **400
`JRXML_BRUTO_PROIBIDO`**. Assim todo lote passou pelos gates G1–G7 e é auditado (`rendered_batch`).

## Alternativas consideradas

- **Parser AST (JDT DOM / JavaParser):** mais preciso, mas o ECJ do `jasperreports-jdt` não traz o DOM —
  exigiria nova dependência. A allowlist léxica é conservadora (recusa em caso de dúvida) e cobre o
  vocabulário que o designer e o Assistente B emitem. Pode ser trocada sem mudar o contrato do gate.
- **Denylist** (`Runtime`, `ProcessBuilder`…): quebrável por reflexão/aliases — rejeitada.
- **Render em processo/contêiner isolado:** defesa em profundidade desejável, mas é infra; fica como
  recomendação de deploy (usuário sem privilégios, filesystem read-only, egress restrito).
- **Assinar o JRXML gerado pelo core:** o designer roda no browser — não há segredo a proteger lá.

## Consequências

- Expressões fora da allowlist deixam de renderizar/publicar com mensagem que nomeia o token. Templates de
  referência e o vocabulário do Assistente B permanecem válidos (teste cobre).
- Logos por URL exigem configurar `REPORTLENZ_RECURSOS_URLS_PERMITIDAS` (ex.: o CDN do cliente).
- Risco residual registrado: o compile cache compartilhado (ADR-008) guarda `JasperReport` serializado no
  Redis — quem escreve no Redis obtém execução de código. Redis DEVE ficar em rede privada com senha
  (`REDIS_PASSWORD`); o deploy (change `empacotamento-deploy`) documenta isso.
- Clientes que usavam batch com `jrxml` bruto precisam publicar o template antes (mudança de contrato da
  RFC-003 §4, registrada aqui).
