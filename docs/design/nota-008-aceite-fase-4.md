# Nota 008 — Aceite da Fase 4 (IA + governança)

**Data:** 2026-07-10 · **Fase:** `phase-4-ai-governance` (tarefas 7.1/7.2)

## 1. Critérios RFC-005 §7 (assistentes de IA)

| Critério | Resultado |
| --- | --- |
| Assistente A produz draft que valida em ≥ X% | **X = 70% (piso medido); média 75%** — 15/20 drafts passam TODOS os gates G1–G6 na 1ª geração (spike 1.1: 10 descrições pt-BR reais, `google/gemini-2.5-flash`, reasoning off, max_tokens 16k). Draft reprovado ainda carrega no editor com o ReportChecker apontando cada problema (mitigação prevista no ADR-010). |
| Assistente B produz expressão válida só com o contrato | ✅ — vocabulário enviado é o ESCOPO do editor; `validarExpressaoInline` roda ANTES do "Usar" (`gerarExpressaoIA.test.tsx`). |
| Nenhuma chamada sai para nuvem por padrão | ⚠️ **Critério emendado pelo ADR-014** (decisão explícita do usuário, 2026-07-10): OpenRouter é o default; inferência local (Ollama/vLLM) permanece disponível por configuração (`REPORTLENZ_LLM_BASE_URL`). Só descrição NL + contrato (nomes/tipos) são enviados — nunca payloads/dados de clientes; a UI avisa. |
| Nenhuma saída contém `<queryString>` | ✅ — **0 ocorrências em ~70 gerações** do spike; anti-Pull em 3 camadas (prompt, gate na saída do serviço, validateSchema no front). |

## 2. Critérios RFC-006 §7 (governança)

| Critério | Resultado |
| --- | --- |
| Publish bloqueado se qualquer gate G1–G6 falhar | ✅ — duas camadas (core `avaliarGates` + `POST /publish/verificar` com a Library real); wizard bloqueia inclusive com a autoridade fora do ar; `422 PUBLISH_BLOQUEADO` no publish persistente; save já recusa G1/G2 (`400 SAVE_REPROVADO`). |
| Versões imutáveis após published; nova edição ⇒ nova versão | ✅ — `409 VERSAO_IMUTAVEL`; re-save após publish abre a próxima versão draft; supersede automático deprecia a anterior (`CicloDeVidaDoTemplateTest`). |
| Auditoria registra publish e batch (LGPD) | ✅ — `report_template_audit`: created/published/deprecated + `rendered_batch` {jobId, total, idempotencyKey}; batch por `templateCodename` usa SÓ a versão published. |
| Biblioteca de blocos com mescla e detecção de conflito | ✅ — 4 blocos **versionados** (proveniência `reportlenz.bloco.<id>=<versão>` no JRXML); conflito renomeia, reescreve expressões e fica VISÍVEL na UI. |

## 3. Números do spike (tarefas 1.1/1.2)

- Evolução: 10–20% (gpt-4o-mini, sem teto de tokens) → 60% (gemini + normalização de forma) → **70–80%** (reasoning off + prompt calibrado). Artefatos em `spike-final-*.json` (scratch da sessão).
- Correções derivadas: truncamento por tokens de *thinking* (reasoning off), seção única emitida como array, banda sem `elements`, pattern dentro de `$P{}`, escopo de coleção, robustez do `avaliarGates` (draft não confiável nunca derruba o processo).
- Latência típica: 5–15s por geração (aceitável para draft inicial; sem streaming por decisão de arquitetura — padrão mentors).

## 4. Pendências que ficam registradas

1. **Grade multi-registro em modo Push** (nota-007 §4) — segue aguardando ADR; os modelos de IA tropeçam exatamente nesse caso (etiquetas), o que reforça a prioridade.
2. **PostgreSQL** (ADR-009) — repositório está no SQLite por decisão; migrar quando o volume/concorrência pedir.
3. Melhoria contínua do prompt/modelo pode subir o X% — o número fica versionado nas tasks e pode ser re-medido com `spike-ia.mjs`.

## 5. Veredito

Fase 4 **aceita**: blocos 1–7 concluídos (18/18 tarefas), gates verdes, CI 4/4.
**Todas as fases do roadmap (0–4) estão concluídas.** Evoluções futuras entram como novos
OpenSpec change packages (CLAUDE.md §9).
