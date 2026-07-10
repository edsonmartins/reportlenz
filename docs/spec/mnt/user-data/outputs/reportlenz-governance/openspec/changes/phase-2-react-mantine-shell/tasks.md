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
- [ ] 5.1 Aproximação no canvas (rotulada)
- [ ] 5.2 Botão "Renderizar (Jasper)" → `POST /render/preview`; PreviewPanel lado a lado

## 6. ReportChecker
- [ ] 6.1 Painel de problemas (validação XSD + contrato, mensagens do core)

## 7. UX
- [ ] 7.1 Tooltips de auto-explicação nos controles
- [ ] 7.2 Galeria de templates iniciais pt-BR (fatura, comprovante, form, etiqueta A4)

## 8. Aposentar Vue
- [ ] 8.1 Paridade mínima atingida → remover a UI Vue do fork
- [ ] 8.2 Aceite RFC-004 §10 (parte base) verde
