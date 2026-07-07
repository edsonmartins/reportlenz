# CONSTITUTION — ReportLenz

> Documento de fundação. Os princípios abaixo são **invariantes**: qualquer ADR, RFC ou change package
> que os contrarie é inválido por construção. Alterar um invariante exige emenda explícita a este
> documento, com justificativa registrada.

---

## Preâmbulo

ReportLenz é um designer web de templates **JRXML** cujo render é executado por uma JasperReports Library
embarcada em um backend Java/Spring Boot. O produto existe para preencher um vão real do ecossistema
Jasper: **não há designer JRXML web open source oficial** — o Jaspersoft Studio é desktop (Eclipse) e o
JasperReports Web Studio é comercial. ReportLenz ocupa esse espaço com um designer web focado,
contract-first e integrado a um stack React/Mantine.

---

## Invariantes

### I-1 — Separação Template / Render
O **template** é um artefato declarativo (JRXML + contrato de dados), produzido em design-time, sem dados
embutidos. O **render** é um processo de run-time, idealmente determinístico: `render(template, payload) → saída`.
Toda a arquitetura deriva desta separação. O template é o ativo durável; a UI que o edita é descartável.

### I-2 — Soberania de dados / LGPD como invariante duro
Nenhum componente de design-time ou de render pode acessar fontes de dados sensíveis na origem. O backend
é o único responsável por montar o payload, **filtrando o que pode sair** antes de entregá-lo ao render.
O relatório nunca toca Consinco/Oracle, J-Control ou qualquer ERP diretamente.

### I-3 — Contract-first, nunca Pull
O template **declara** os dados que espera (campos, parâmetros, tipos, cardinalidade) como um contrato —
não embute query, conexão ou SQL. O modelo é **Push**: o backend satisfaz o contrato. `<queryString>` no
JRXML é proibido e recusado na validação. Este invariante é também a tese de diferenciação do produto.

### I-4 — Soberania de inferência: IA local preferencial
Assistência de IA (geração de layout, geração de expressão) roda preferencialmente em infraestrutura
local (GPU on-premises). Layout de cliente, contrato de dados e dados de exemplo não são enviados a
serviços de nuvem de terceiros sem decisão explícita e consentimento.

### I-5 — Spec-driven development
Toda decisão arquitetural relevante é registrada (ADR), toda funcionalidade não-trivial é especificada
(RFC + OpenSpec change) **antes** da implementação. "Pass 5 como única autoridade sobre 'done'": uma
entrega só está concluída quando passa pela validação definida em sua spec.

### I-6 — Fronteira de licença limpa
A JasperReports Library (LGPLv3) é consumida **como dependência**, sem modificação dos seus fontes e sem
redistribuição do JAR a terceiros. Todo código próprio (`jrxml-core`, UI, serviço de render) vive fora da
Library. Modificar a Library aciona obrigações de copyleft e é proibido sem ADR específico.

### I-7 — Núcleo agnóstico de framework
A lógica de domínio do relatório (parser, serializer, validador, extrator de contrato) vive em um pacote
TypeScript **headless** (`jrxml-core`), sem dependência de Vue, React ou DOM. A UI consome o core; o core
não conhece a UI.

### I-8 — Fidelidade honesta de preview
O designer não simula a verdade do Jasper. O preview tem duas velocidades: uma **aproximação instantânea**
no browser (rotulada como tal) e o **render real sob demanda** via o mesmo engine da produção. Nunca se
apresenta a aproximação como se fosse o output final.

---

## Stack canônico

| Camada | Tecnologia |
|--------|-----------|
| Engine de render | JasperReports Library 7.0.7 (LGPLv3) |
| Backend / orquestração | Java 21, Spring Boot 3.x |
| Núcleo de domínio | TypeScript (headless, framework-agnóstico) |
| UI do designer | React 18, Mantine v9, Archbase |
| Persistência | PostgreSQL (templates, versões, contratos) |
| Observabilidade | OpenTelemetry, VictoriaMetrics, Grafana, Loki, Tempo |
| Auth | Keycloak + Azure AD |
| IA (assistência) | Inferência local (GPU on-premises) |

---

## Fora de escopo (explicitamente)

- **Impressão térmica / etiquetas (ZPL/EPL/ESC-POS)**: o engine Jasper não emite esses protocolos. Etiqueta
  física é um pipeline separado (ver ADR-011), não responsabilidade do designer JRXML.
- **Migração de JRXML legado 6.x → 7.x**: a conversão entre dialetos só é suportada pelo Jaspersoft Studio 7+.
  ReportLenz nasce mirando o dialeto 7; importação de legado é trabalho futuro, não fundação.
- **JasperReports Server / Web Studio / IO** (comerciais): não são dependências do produto.

---

## Emendas

Emendas a este documento são registradas como ADRs do tipo `Constitutional`, com supersessão explícita do
texto anterior. A versão vigente é a do `master`.
