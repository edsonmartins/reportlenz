# Nota de design 006 — Aposentadoria da UI Vue e aceite da Fase 2

- **Data:** 2026-07-10
- **Tarefas:** phase-2/8.1, phase-2/8.2
- **Relacionado:** ADR-004, ADR-005, RFC-004 §10 (parte base), notas 001/002

## 8.1 — Aposentadoria da UI Vue

**O fork Vue (`fengyunhe/jrxml_web_designer`) está aposentado.** Decisão do usuário (2026-07-10):
não guardar o Vue — o objetivo sempre foi **reproduzir em React** o que ele fazia. O clone local
foi removido; o que o fork contribuiu está preservado nas notas 001 (veredito 6.x) e 002
(marcadores de dialeto) e nos fixtures negativos de `LEGACY_DIALECT`.

### Paridade funcional (o que o Vue fazia × o React de hoje)

| Capacidade do fork Vue | Reprodução no ReportLenz | Situação |
|---|---|---|
| Parser/serializer JRXML (6.x, ~5.900 linhas) | `jrxml-core` TS headless mirando **dialeto 7**, aceito pela Library real (harness) | ✅ superado |
| Validação XSD (xerces-wasm contra XSD 6.x) | Validação estrutural do dialeto 7 + gate na Library (ADR-013) + `validateContract` (G3) | ✅ superado |
| Canvas de design (bandas/elementos) | Canvas React completo: réguas mm, grid, snap com guias, multi-seleção, align/distribute, z-order, nudge, copy/paste, undo/redo por gesto | ✅ superado |
| Painel de propriedades | Com **herança visual** (padrão Jaspersoft) e filtro | ✅ superado |
| Query/SQL no template (modelo Pull do fork) | **Deliberadamente NÃO reproduzido** — substituído pelo DataContractPanel contract-first (ADR-003) | ✅ por design |
| Preview | Aproximação rotulada + render REAL via `POST /render/preview` (PNG paginado) | ✅ superado |
| Editor de XML (CodeMirror) e chat de IA | Fora do escopo da Fase 2 (expression editor é Fase 3; IA é Fase 4 — RFC-005) | ⏭ fases seguintes |

## 8.2 — Aceite RFC-004 §10 (parte base da Fase 2)

Auditoria de 2026-07-10: **84 testes (jrxml-core) + 80 (designer React) + 29 (render-service)**,
lint/typecheck/builds verdes nas três pilhas.

| Critério §10 | Evidência |
|---|---|
| Canvas: snapping, multi-seleção, align/distribute, undo/redo, réguas mm | Bloco 2 completo (2.1-2.7); snap com guias e prioridade elemento>grid; undo coalescido por gesto; réguas mm com física A4 verificada |
| Propriedades com herança visual | Bloco 3: cadeia local→styleRef→parent→default→engine; cinza/preto; × volta a herdar |
| Expression editor com autocomplete e validação contra o contrato | **Parte base entregue**: validação de `$F/$P/$V` contra o contrato em toda mutação + ReportChecker navegável. Autocomplete é Fase 3 (RFC-004 §5: "maior ganho — Fase 3") |
| DataContractPanel sem qualquer caminho de Pull | Bloco 4: teste afere a AUSÊNCIA (sem query/sql/jdbc/conexão no painel; sem API p/ isso) |
| Preview real via endpoint Jasper | Bloco 5: PNG paginado, 422 com violações; reconciliação schema↔fill no serviço |

## Descobertas da fase (catálogo)

- Mantine 9.4 exige React 19.2 (ADR-005 dizia 18 — desvio de versão registrado).
- `inputSchema` valida payload ANINHADO × `$F{a.b}` resolve chave pontuada → achatamento no
  pipeline do render-service.
- Serializer do core recusava silenciosamente kind desconhecido → agora erro explícito.
- jsdom: Accordion do Mantine esconde conteúdo durante animação (transitionDuration=0);
  mutação direta no store exige act() no React 19; mouseenter não borbulha.

## Pendências herdadas pela Fase 3

- Paleta de elementos (arrastar novos elementos para o canvas) — a inserção hoje é por
  copy/paste/galeria; a Palette da RFC-004 §2 entra com as features pro.
- Expression editor com autocomplete sobre o contrato (RFC-004 §5).
- Editor de tabela (merge/split), estilos condicionais na UI, multi-coluna avançado, blocos
  reutilizáveis (RFC-004 §8).
