# ADR-026 — Backend Java embarcável: `reportlenz-core` + `reportlenz-spring-boot-starter`

- **Status:** Accepted (pedido do usuário em 2026-11-27)
- **Data:** 2026-11-27
- **Relacionado:** ADR-001 (render Java nativo), ADR-006 (fronteira LGPL), ADR-016/020/021 (G7, G8, filtro
  de classes), ADR-017 (segurança), ADR-018 (Flyway, limites), ADR-025 (componente React)
- **Implementa:** `openspec/changes/backend-embarcavel`

## Contexto

O render-service é uma aplicação Spring Boot 4 monolítica. O objetivo é **importar o ReportLenz dentro dos
backends Java das aplicações**, que também são Spring Boot 4. O componente React (ADR-025) passaria a
falar com o **próprio backend da aplicação**, sem um serviço separado.

Decisões do usuário em 2026-11-27:

- Spring Boot 4;
- **núcleo + starter com a API**;
- **Maven Central**;
- registro, batch, IA e segurança própria **ligados por padrão**, cada um desligável por propriedade.

O que impede o embarque hoje:

1. **Pipeline acoplado ao Spring:** `@Component`, Redis no cache compartilhado e o registro JDBC nos
   subreports.
2. **Flyway na tabela padrão:** colidiria com o Flyway da aplicação (mesma `flyway_schema_history`).
3. **Segurança global:** uma `SecurityFilterChain` para `/**` brigaria com a da aplicação.
4. **Rotas na raiz:** `/render`, `/templates` etc. podem colidir com rotas da aplicação.

## Decisão

### 1. Módulos Maven (multi-módulo, Java 21)

| Artefato | O que é |
|---|---|
| `reportlenz-parent` | BOM/parent: versões e plugins de publicação |
| `reportlenz-core` | **Java puro**, sem Spring. Compilador com G7, contexto restrito e filtro de classes, pipeline (fill/PDF/PNG), coerção e validação de payload, verificação de gates G1/G2/G7/G8 e a fachada **`MotorReportLenz`** |
| `reportlenz-spring-boot-starter` | Auto-configuração: o motor como bean, registro JDBC, endpoints, segurança escopada, batch, IA e limites |
| `render-service` | A aplicação standalone de sempre: **só** o starter, uma classe `main` e a configuração (dogfooding) |

### 2. Fachada do núcleo

```java
MotorReportLenz motor = MotorReportLenz.builder()
    .urlsPermitidas(List.of("https://cdn.empresa.com.br/"))   // imagens (ADR-016)
    .subreports(ref -> registro.jrxmlPublicado(ref))           // G8 / repo: (ADR-020)
    .build();
byte[] pdf = motor.renderizarPdf(jrxml, payload);              // G7 + filtro de classes sempre ativos
List<byte[]> pngs = motor.renderizarPng(jrxml, payload);
ResultadoDosGates gates = motor.verificarGates(jrxml, inputSchema, codename);
motor.validarPayload(inputSchema, payload);                    // PayloadForaDoContrato
```

As barreiras de segurança **não são opcionais** no núcleo: G7, contexto restrito e filtro de classes
estão sempre ligados.

### 3. Starter dentro de uma aplicação existente

- **Rotas** sob o prefixo `reportlenz.api.prefixo` (padrão `/reportlenz`). O componente React usa
  `apiBaseUrl="https://app/reportlenz"`. O render-service standalone usa prefixo vazio, mantendo as rotas
  atuais.
- **Segurança** (`reportlenz.seguranca.habilitada=true`):
  - `SecurityFilterChain` própria, com `securityMatcher(prefixo/**)` e ordem alta. A cadeia da aplicação
    continua cuidando do resto.
  - A política fica igual: JWT Keycloak, papéis e ator do token.
  - Desligada, o ReportLenz usa a segurança que a aplicação já tem, e ela mapeia os papéis
    `reportlenz-*`.
- **Registro** (`reportlenz.registro.habilitado=true`):
  - usa o `DataSource` da aplicação;
  - as migrações rodam numa **instância Flyway própria**, com `table=reportlenz_schema_history` e
    `locations=classpath:reportlenz/db/migration`, sem tocar no Flyway da aplicação;
  - as tabelas mantêm os nomes atuais, já prefixados por domínio.
- **Batch** (`reportlenz.batch.habilitado=true`), **IA** (`reportlenz.assistente.habilitado=true`) e
  **limites:**
  - ligados por padrão;
  - batch exige Redis e S3: sem eles o boot **falha com mensagem clara**, porque não há modo silencioso;
  - IA sem chave responde 503, como hoje.
- Todo bean é `@ConditionalOnMissingBean`: a aplicação pode substituir peças, como o cache de compilação
  ou a fonte de subreports.

### 4. Publicação

> **Emenda (2026-11-27):**
> - O processo segue o do archflow:
>   - perfil `maven-central` com POM achatado (`flatten`, modo `ossrh`);
>   - o `reportlenz-parent` não é publicado;
>   - opt-in `reportlenz.publish.skip`;
>   - Maven 3.9 fixo;
>   - recusa de versão já publicada;
>   - workflow Central Dry Run.
> - Os segredos usam os nomes do archflow: `MAVEN_CENTRAL_USERNAME`, `MAVEN_CENTRAL_TOKEN`,
>   `GPG_PRIVATE_KEY` e `MAVEN_GPG_PASSPHRASE`.
> - **`groupId`:** `br.com.archbase`, o namespace do Archbase, já verificado no Central. Foi decisão do
>   usuário, depois que o Central recusou `dev.reportlenz`: o domínio `reportlenz.dev` não existe. Os
>   pacotes Java continuam `dev.reportlenz.*`.

- Maven Central, com sources, javadoc e assinatura GPG via `central-publishing-maven-plugin`, num job no
  mesmo `release.yml` disparado por tag.
- O namespace do `groupId` precisa estar **verificado** no Central. Hoje é `dev.reportlenz`, que exige o
  domínio `reportlenz.dev`. A alternativa é `io.github.<dono>`. A decisão e as chaves GPG ficam com o
  usuário.

## Alternativas consideradas

- **Só o starter, sem um núcleo Java puro.** Prenderia quem só quer gerar PDF ao contexto Spring inteiro.
  Rejeitada, por decisão do usuário.
- **Flyway da aplicação com as nossas migrações juntas.** Misturaria o histórico e a ordem de versões das
  duas, e conflitaria em `V1`, `V2`. Rejeitada em favor da instância isolada.
- **Uma cadeia de segurança global.** Quebraria a segurança da aplicação hospedeira. Rejeitada em favor
  da cadeia escopada.

## Consequências

- A API do `MotorReportLenz` e as propriedades `reportlenz.*` viram contrato público (semver).
- A JasperReports continua sendo dependência Maven, não redistribuída (ADR-006). Os artefatos do
  ReportLenz são código próprio (MIT).
- O render-service passa a ser "o starter + configuração". O E2E dele testa o starter.
- Uma aplicação Spring de teste (`exemplos/host-spring`), com segurança e Flyway próprios, prova a
  coexistência no CI.
