# Tasks — phase-4-ai-governance

## 1. Spike de viabilidade (gate p/ ADR-010 Accepted)
- [x] 1.1 Taxa de draft VÁLIDO (gates G1–G6) na 1ª geração medida com o provedor do ADR-014: 75% (15/20 nas rodadas finais; 10 descrições pt-BR × 2, google/gemini-2.5-flash, reasoning off, max_tokens 16k) — partiu de 10-20% antes das correções do spike; 0 ocorrências de Pull em ~70 gerações
- [x] 1.2 Binding: ~10 refs $F/$P/$V por draft, alucinação capturada por G3 (EXPR_UNKNOWN_REF) e exibida ANTES de carregar; decisão: ADR-014 confirmado Accepted (mitigação = draft + checker + biblioteca de blocos, como previa o ADR-010)

## 2. Assistente A — NL → JRXML
- [x] 2.1 Serviço de inferência configurável — OpenRouter default, local (Ollama/vLLM) por base-url (ADR-014 emenda o ADR-010; decisão explícita do usuário em 2026-07-10); chave/modelo só no backend
- [x] 2.2 Prompt/sistema com proibição de Pull + gate anti-Pull também na SAÍDA da IA (defesa em profundidade)
- [x] 2.3 Geração de `ReportTemplate` (draft) a partir de NL + contrato (POST /assist/gerar-template; refino com templateAtual; AssistenteDrawer)
- [x] 2.4 Validação obrigatória (estrutural + contrato) antes de exibir: normalizarDraft + validarDocumento no drawer; problemas visíveis antes do "Carregar rascunho"

## 3. Assistente B — NL → expressão
- [x] 3.1 Tradução NL → expressão JR válida contra o contrato (POST /assist/gerar-expressao; vocabulário = escopo do editor; prompt ensina BigDecimal/funções/ternário)
- [x] 3.2 Validação inline + ReportChecker (✨ no ExpressionEditor: validarExpressaoInline ANTES do "Usar"; pós-commit a validação contínua segue)

## 4. Gates de governança (RFC-006)
- [x] 4.1 G1 (estrutural no core + load/compile pela Library real no serviço — ADR-013) · G2 anti-Pull · G3 integridade de expressão
- [x] 4.2 G4 dialeto · G5 contrato presente (inputSchema válido 2020-12) · G6 jrxml_hash recalculado/consistente
- [x] 4.3 Publish bloqueado se qualquer gate falhar — inclusive se a verificação autoritativa (POST /publish/verificar) estiver indisponível; PublishWizard com checklist G1–G6 e pacote de integração

## 5. Repositório / ciclo de vida
- [x] 5.1 Modelo `report_template` / `report_template_version` + `report_template_audit` (ADR-009/RFC-006 §4) em SQLite (decisão: começar no SQLite; PostgreSQL quando escalar)
- [x] 5.2 Estados draft→published→deprecated: draft mutável; published IMUTÁVEL (409 VERSAO_IMUTAVEL; nova edição = nova versão); supersede deprecia a anterior; publish reconfere gates (422 PUBLISH_BLOQUEADO) e save valida G1/G2 (400 SAVE_REPROVADO)
- [x] 5.3 Auditoria: created/published/deprecated + `rendered_batch` (batch por `templateCodename` usa SÓ a versão published e audita jobId/total/idempotencyKey)

## 6. Biblioteca de blocos
- [x] 6.1 Blocos versionados: campo `versao` em cada bloco da biblioteca; inserção carimba `reportlenz.bloco.<id>=<versão>` nas properties (proveniência auditável no JRXML publicado)
- [x] 6.2 Mescla de mini-contrato + detecção de conflito (implementada em phase-3/8.2: compatível reaproveita, incompatível renomeia e reescreve expressões) — avisos agora VISÍVEIS na UI (alert dispensável)

## 7. Aceite
- [x] 7.1 Critérios RFC-005 §7 e RFC-006 §7 verdes — mapa de evidências na nota-008 (X do Assistente A = 70% piso/75% média)
- [x] 7.2 Nuvem por padrão via ADR-014 (emenda registrada; local por config); sem `<queryString>` em NENHUMA saída (0 em ~70 gerações + anti-Pull em 3 camadas)
