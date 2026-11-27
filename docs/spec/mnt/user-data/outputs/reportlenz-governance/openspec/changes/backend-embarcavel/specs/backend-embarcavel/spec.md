# Spec: backend-embarcavel (capability) — ReportLenz dentro do backend da aplicação

## ADDED Requirements

### Requirement: Núcleo Java sem Spring
O artefato `reportlenz-core` SHALL renderizar PDF/PNG de um JRXML 7 com um payload Push por uma API Java,
com G7, contexto restrito e filtro de classes sempre ativos, sem depender de Spring.

#### Scenario: Renderizar pela API Java
- **WHEN** a aplicação chama `MotorReportLenz.builder().build().renderizarPdf(jrxml, payload)`
- **THEN** recebe o PDF, com a mesma coerção e o mesmo locale pt-BR do serviço

#### Scenario: Barreiras sempre ligadas
- **WHEN** o JRXML tem expressão fora da allowlist ou uma imagem de arquivo local
- **THEN** o motor recusa (`ExpressaoProibida` / recurso recusado), sem opção de desligar

### Requirement: Starter coexistindo com a aplicação
O `reportlenz-spring-boot-starter` SHALL subir os endpoints do ReportLenz numa aplicação Spring Boot 4
existente, sem interferir nas rotas, na segurança e nas migrações dela.

#### Scenario: Rotas sob prefixo
- **WHEN** a aplicação importa o starter com o prefixo padrão
- **THEN** o preview responde em `/reportlenz/render/preview` e as rotas da aplicação seguem intactas

#### Scenario: Segurança escopada
- **WHEN** a aplicação tem a própria `SecurityFilterChain` e o starter está com segurança habilitada
- **THEN** as rotas da aplicação seguem a cadeia dela e as do ReportLenz exigem o JWT e os papéis do ADR-017

#### Scenario: Flyway isolado
- **WHEN** a aplicação usa Flyway com as próprias migrações `V1`, `V2`…
- **THEN** as migrações do ReportLenz rodam em `reportlenz_schema_history`, sem conflito de versões

#### Scenario: Infraestrutura ausente
- **WHEN** o batch está habilitado (padrão) e não há Redis ou S3 configurados
- **THEN** o boot falha com mensagem que diz o que configurar ou como desligar (`reportlenz.batch.habilitado=false`)

#### Scenario: Peça substituível
- **WHEN** a aplicação declara o próprio bean de cache de compilação ou de fonte de subreports
- **THEN** o starter usa o da aplicação
