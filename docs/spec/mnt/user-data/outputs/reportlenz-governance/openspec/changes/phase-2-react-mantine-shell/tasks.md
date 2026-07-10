# Tasks — phase-2-react-mantine-shell

## 1. Scaffold da UI
- [x] 1.1 Pacote `jrxml-designer-react` (React **19.2** — exigência do Mantine 9.4, que dropou o 18; Archbase 4.x suporta ambos; ADR-005 dizia 18), Mantine 9.4, Archbase 4.0.36; store do documento (`ReportTemplate`) em zustand com seleção por caminho; workspace pnpm ativado (previsto na decisão de layout da Fase 0)
- [x] 1.2 Integração com `jrxml-core` (serialize → validateSchema + validateContract em toda mutação → `problemas`; poda de seleção pendurada)

## 2. Canvas
- [x] 2.1 Página A4/custom em pt; réguas mm/cm; grid (+ guias de margem e de coluna p/ etiqueta A4; zoom 25–400%)
- [x] 2.2 Bandas (title..summary, groups) com resize de altura (ordem de design view; clamp no rodapé do elemento mais baixo)
- [x] 2.3 Elementos selecionáveis/movíveis/resizable (8 handles; clamp na banda; Shift = seleção aditiva; aproximação visual por kind)
- [x] 2.4 Snapping com guias de alinhamento (bordas/centros vizinhos + bordas da banda; prioridade sobre o grid; Alt ignora; toggle na toolbar)
- [x] 2.5 Multi-seleção; alinhar/distribuir; z-order (mesma banda; z-order = ordem de pintura do JRXML, seleção acompanha os novos índices)
- [x] 2.6 Nudge (setas 1pt/Shift 10pt), copy/paste (clipboard interno; colar re-seleciona e desloca +5pt acumulativo), delete
- [x] 2.7 Undo/redo com histórico (snapshots imutáveis, limite 100; arrastes coalescem por gesto; Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y + botões)

## 3. Painel de propriedades
- [x] 3.1 Todos os atributos JR do elemento (bounds, aparência, específicos por kind, styleRef, printWhen)
- [x] 3.2 Herança visual (cinza-claro herdado / preto sobrescrito; × volta a herdar; cadeia local → styleRef → parent → default → engine)
- [x] 3.3 Filtro por nome (busca sem acento)

## 4. DataContractPanel (contract-first)
- [x] 4.1 Declaração de fields/params/vars (escalar, objeto via nomes pontuados, coleção com itemFields aninhados)
- [x] 4.2 Geração de `inputSchema` via core (ao vivo, memoizada pelo contrato); SEM Query Editor/JDBC/Query Preview (teste de ausência)

## 5. Preview
- [x] 5.1 Aproximação no canvas (rotulada: "Aproximação — a verdade é o render Jasper")
- [x] 5.2 Botão "Renderizar (Jasper)" → `POST /render/preview` (jrxml + sampleData gerado do contrato + inputSchema); PreviewPanel lado a lado com PNG paginado, 422 com violações e erro de indisponibilidade; render-service achata payload aninhado → chaves pontuadas (reconciliação schema↔fill)

## 6. ReportChecker
- [x] 6.1 Painel de problemas (mensagens do core com código/mensagem/caminho; clique navega até o elemento; recolhível)

## 7. UX
- [x] 7.1 Tooltips de auto-explicação nos controles (zoom/grid/snap/align/z-order/undo-redo/render/badge de validação/limpar sobrescrita/required)
- [x] 7.2 Galeria de templates iniciais pt-BR (em branco + fatura, comprovante, form, etiqueta A4 — os mesmos validados pelo harness)

## 8. Aposentar Vue
- [ ] 8.1 Paridade mínima atingida → remover a UI Vue do fork
- [ ] 8.2 Aceite RFC-004 §10 (parte base) verde
