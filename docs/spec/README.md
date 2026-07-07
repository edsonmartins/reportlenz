# ReportLenz — Pacote de Governança

> **Codinome provisório:** `ReportLenz` (família DocLenz/DeskLenz). Trocável por find-replace.
> **Status global:** Draft de fundação (Fase 0 pendente de início)
> **Engine alvo:** JasperReports Library 7.0.7 (LGPLv3)
> **Stack alvo:** Java 21 / Spring Boot 3.x (render) · TypeScript headless (`jrxml-core`) · React 18 + Mantine v9 + Archbase (UI)

ReportLenz é um **designer web de templates JRXML, contract-first**, que evolui a partir de um fork do
`jrxml_web_designer`. O render é executado nativamente em Java pela JasperReports Library embarcada no
Spring Boot (decisão registrada no ADR-001, "Caminho A"). O diferencial de produto é a recusa deliberada
do modelo *Pull* (SQL embutido no relatório) em favor de um **contrato de dados declarativo** (modelo
*Push*), preservando a soberania de dados / LGPD como invariante.

## Índice de artefatos

### Constituição
- [`CONSTITUTION.md`](./CONSTITUTION.md) — princípios invariantes que governam todas as decisões.

### ADRs — Architecture Decision Records (`docs/adr/`)
| ID | Título | Status |
|----|--------|--------|
| [ADR-001](docs/adr/ADR-001-render-java-nativo-caminho-a.md) | Render Java-nativo com JasperReports (Caminho A) | Accepted |
| [ADR-002](docs/adr/ADR-002-version-target-jrxml-707.md) | JRXML 7.0.7 como version target canônico | Accepted |
| [ADR-003](docs/adr/ADR-003-contract-first-push-binding.md) | Binding contract-first (Push), proibição de Pull | Accepted |
| [ADR-004](docs/adr/ADR-004-jrxml-core-headless.md) | Extração do `jrxml-core` headless | Accepted |
| [ADR-005](docs/adr/ADR-005-ui-react-mantine.md) | Casca de UI em React/Mantine/Archbase | Accepted |
| [ADR-006](docs/adr/ADR-006-fronteira-licenca-lgplv3.md) | Fronteira de licença LGPLv3 | Accepted |
| [ADR-007](docs/adr/ADR-007-matriz-dependencias-maven-jr7.md) | Matriz de dependências Maven (JR7 modular) | Accepted |
| [ADR-008](docs/adr/ADR-008-preview-round-trip-compile-cache.md) | Preview round-trip + compile cache | Accepted |
| [ADR-009](docs/adr/ADR-009-versionamento-template-inputschema.md) | Versionamento de template + inputSchema | Accepted |
| [ADR-010](docs/adr/ADR-010-inferencia-ia-local.md) | Inferência de IA local para assistência de design | Proposed |
| [ADR-011](docs/adr/ADR-011-pipeline-termico-fora-de-escopo.md) | Pipeline térmico/etiqueta fora do engine Jasper | Accepted |
| [ADR-012](docs/adr/ADR-012-plano-b-embarcar-web-studio.md) | Plano B: embarcar JasperReports Web Studio | Rejected (contingência) |

### RFCs — Request for Comments (`docs/rfc/`)
| ID | Título | Fase |
|----|--------|------|
| [RFC-001](docs/rfc/RFC-001-jrxml-core.md) | `jrxml-core`: modelo de domínio, parser/serializer, validação | 0 |
| [RFC-002](docs/rfc/RFC-002-contrato-de-dados-inputschema.md) | Contrato de dados (`inputSchema`) + extração + codegen | 1 |
| [RFC-003](docs/rfc/RFC-003-servico-de-render.md) | Serviço de render (preview + batch) | 1 |
| [RFC-004](docs/rfc/RFC-004-arquitetura-ui-designer.md) | Arquitetura da UI do designer | 2/3 |
| [RFC-005](docs/rfc/RFC-005-assistente-ia-design.md) | Assistente de IA de design (NL→JRXML, NL→expressão) | 4 |
| [RFC-006](docs/rfc/RFC-006-repositorio-templates-governanca.md) | Repositório de templates e gates de governança | 4 |

### OpenSpec — Change Packages (`openspec/changes/`)
| Change ID | Fase | Entrega |
|-----------|------|---------|
| [phase-0-extract-jrxml-core](openspec/changes/phase-0-extract-jrxml-core/proposal.md) | 0 | Núcleo headless (parser/serializer/validador) |
| [phase-1-render-contract-first](openspec/changes/phase-1-render-contract-first/proposal.md) | 1 | Endpoint de render/preview + painel de dados contract-first |
| [phase-2-react-mantine-shell](openspec/changes/phase-2-react-mantine-shell/proposal.md) | 2 | Casca React/Mantine sobre o core, aposentando Vue |
| [phase-3-editor-pro-features](openspec/changes/phase-3-editor-pro-features/proposal.md) | 3 | Expression editor, barcodes, estilos condicionais, grupos/subreports, pt-BR |
| [phase-4-ai-governance](openspec/changes/phase-4-ai-governance/proposal.md) | 4 | Assistente IA local, biblioteca de blocos, gates de governança |

## Mapa de dependência entre fases

```
Fase 0  ──►  Fase 1  ──►  Fase 2  ──►  Fase 3  ──►  Fase 4
core         render+      casca        features      IA +
headless     contrato     React        pro           governança
             (preview)
```

Cada fase é planejada em entregas *session-sized* (ver `tasks.md` de cada change package), conforme o
princípio de granularidade de tarefa adotado em projetos anteriores (Gestor-RQ).

## Convenções

- **ADR**: decisão tomada, com contexto, alternativas e consequências. Imutável após `Accepted`; mudança = novo ADR que supersede.
- **RFC**: proposta técnica detalhada (design, contratos de interface, API). Evolui por revisão.
- **OpenSpec change**: unidade de mudança com `proposal.md`, `tasks.md` e `specs/<capability>/spec.md` (requisitos em formato `## ADDED/MODIFIED Requirements` + `#### Scenario:`).
