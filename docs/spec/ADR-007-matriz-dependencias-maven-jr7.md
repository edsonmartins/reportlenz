# ADR-007 — Matriz de dependências Maven (JR7 modular)

- **Status:** Accepted
- **Data:** 2026-06-28
- **Relacionado:** ADR-002, ADR-006, RFC-003

## Contexto

A JasperReports Library 7 **extraiu vários JARs de extensão opcionais do JAR core** (migração Jakarta +
melhor gestão de dependências). Funcionalidades que vinham no core do 6.x agora são artefatos separados —
notavelmente a **geração de PDF** (`jasperreports-pdf`) e as **fontes** (`jasperreports-fonts`). Alguns
pacotes Java mudaram de nome. Migrar do 6.x esperando "tudo no core" quebra.

## Decisão

Declarar explicitamente a matriz de dependências modular no `pom.xml` do serviço de render. Conjunto
mínimo para o caso de ReportLenz (PDF + acentuação pt-BR):

```xml
<!-- Versões geridas via dependencyManagement; 7.0.7 como alvo (ADR-002) -->
<properties>
  <jasperreports.version>7.0.7</jasperreports.version>
</properties>

<dependencies>
  <!-- Core do engine: modelo, compile, fill -->
  <dependency>
    <groupId>net.sf.jasperreports</groupId>
    <artifactId>jasperreports</artifactId>
    <version>${jasperreports.version}</version>
  </dependency>

  <!-- Exportação PDF — ARTEFATO SEPARADO no JR7 (essencial p/ fatura/comprovante) -->
  <dependency>
    <groupId>net.sf.jasperreports</groupId>
    <artifactId>jasperreports-pdf</artifactId>
    <version>${jasperreports.version}</version>
  </dependency>

  <!-- Fontes — acentuação pt-BR correta -->
  <dependency>
    <groupId>net.sf.jasperreports</groupId>
    <artifactId>jasperreports-fonts</artifactId>
    <version>${jasperreports.version}</version>
  </dependency>

  <!-- Funções de relatório (se usadas em expressões) -->
  <dependency>
    <groupId>net.sf.jasperreports</groupId>
    <artifactId>jasperreports-functions</artifactId>
    <version>${jasperreports.version}</version>
  </dependency>

  <!-- Metadata — introspecção do modelo (apoia geração de inputSchema, RFC-002) -->
  <dependency>
    <groupId>net.sf.jasperreports</groupId>
    <artifactId>jasperreports-metadata</artifactId>
    <version>${jasperreports.version}</version>
  </dependency>
</dependencies>
```

> A lista exata de artefatos deve ser validada contra o BOM/POM da 7.0.7 no momento da implementação;
> os nomes acima refletem a modularização conhecida do trilho 7.0.x.

## Consequências

- **PDF e fontes precisam ser declarados** — não vêm no core. Falha silenciosa comum em quem migra do 6.x.
- O **`jasperreports-metadata`** apoia o contract-first (RFC-002): expõe a estrutura do modelo
  (campos/parâmetros) para geração programática do `inputSchema`.
- **Imports da era 6.x estão errados**: trabalhar só com docs/exemplos 7.x (alguns pacotes Java mudaram de
  nome).
- Charts: o JR7 atualizou JFreeChart 1.5.4, **sem suporte a 3D** — Pie/Bar/Stacked 3D renderizam como 2D.
  Não usar gráficos 3D em templates.

## Política

A matriz é revisada a cada patch da Library (verificar novos artefatos ou renomeações no changelog).
