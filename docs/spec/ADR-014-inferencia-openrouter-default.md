# ADR-014 — Inferência de IA via OpenRouter por padrão (emenda ao ADR-010)

- **Status:** Accepted
- **Data:** 2026-07-10
- **Relacionado:** ADR-010 (emendado), I-4 (Constituição), RFC-005
- **Decisor:** Edson Martins (decisão explícita registrada em sessão de 2026-07-10)

## Contexto

O ADR-010 propôs inferência **local por padrão** (RTX 3060/Mac M4), com nuvem só mediante decisão
explícita + consentimento (I-4). Na entrada da Fase 4, dois projetos de referência do usuário foram
avaliados como molde do assistente:

- `mentors-ipaas-admin`: copiloto **thin-client** (Drawer Mantine + REST sem streaming), prompts e chaves
  só no backend, LLM via **OpenRouter**; a saída é JSON estruturado que o usuário aplica como rascunho.
- `archflow`: CopilotKit v2 (pré-release) + protocolo AG-UI com streaming SSE e frontend-tools que editam
  o canvas diretamente.

O usuário escolheu o **padrão mentors** (adere 1:1 ao pipeline draft+gates da RFC-005) e decidiu
explicitamente usar **OpenRouter como provedor default** de inferência.

## Decisão

1. O assistente de IA do ReportLenz chama o LLM **somente pelo backend** (render-service). Prompts,
   chaves e escolha de modelo nunca chegam ao front.
2. **Provedor default: OpenRouter** (`OPENROUTER_API_KEY`), com endpoint e modelo configuráveis por env
   (`REPORTLENZ_LLM_BASE_URL`, `REPORTLENZ_LLM_MODEL`). O protocolo é OpenAI-compatível — apontar a
   base-url para Ollama/vLLM local mantém o caminho **local como opt-in** (I-4 preservado como opção,
   invertendo apenas o default do ADR-010).
3. **Consentimento (I-4/LGPD):** esta decisão registra o consentimento para envio de descrição NL e
   contrato de dados ao provedor configurado. A UI exibe aviso permanente de que o conteúdo é enviado ao
   provedor. **Dados de exemplo/payloads de clientes NÃO são enviados** — o assistente recebe apenas a
   descrição e o contrato (nomes/tipos), nunca dados.
4. Permanecem intactas as regras do ADR-010: a IA **não fura gates** (validação obrigatória XSD/dialeto +
   contrato pós-geração), **nunca** gera `<queryString>` (anti-Pull no prompt E na validação), e a saída é
   sempre **draft editável**, nunca auto-publicada.

## Consequências

- Qualidade de geração imediata (modelos de fronteira), sem depender do spike de modelos locais — o spike
  do ADR-010 (tarefas 4/1.x) passa a medir a taxa de draft válido no provedor configurado.
- O contrato de dados (estrutura, não dados) transita pela nuvem do provedor — aceito nesta emenda.
- Trocar para inferência local é operação de configuração, não de código.
