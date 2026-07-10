# Tasks — phase-4-ai-governance

## 1. Spike de viabilidade (gate p/ ADR-010 Accepted)
- [ ] 1.1 Medir taxa de JRXML 7 válido na primeira geração por modelo local
- [ ] 1.2 Medir qualidade do binding ao contrato; decidir Accepted/ajuste

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
- [ ] 5.1 Modelo `report_template` / `report_template_version` (ADR-009)
- [ ] 5.2 Estados draft→published→deprecated; imutabilidade do published
- [ ] 5.3 Auditoria (`report_template_audit`): publish, batch (rastreabilidade LGPD)

## 6. Biblioteca de blocos
- [ ] 6.1 Blocos versionados (cabeçalho, rodapé com totais, assinatura, QR)
- [ ] 6.2 Mescla de mini-contrato do bloco ao contrato do template + detecção de conflito

## 7. Aceite
- [ ] 7.1 Critérios RFC-005 §7 e RFC-006 §7 verdes
- [ ] 7.2 IA sem chamadas a nuvem por padrão; sem `<queryString>` em nenhuma saída
