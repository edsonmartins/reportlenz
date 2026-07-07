# Tasks — phase-2-react-mantine-shell

## 1. Scaffold da UI
- [ ] 1.1 Pacote `jrxml-designer-react` (React 18, Mantine v9, Archbase); store do documento (`ReportTemplate`)
- [ ] 1.2 Integração com `jrxml-core` (parse/serialize/validate em toda mutação)

## 2. Canvas
- [ ] 2.1 Página A4/custom em pt; réguas mm/cm; grid
- [ ] 2.2 Bandas (title..summary, groups) com resize de altura
- [ ] 2.3 Elementos selecionáveis/movíveis/resizable
- [ ] 2.4 Snapping com guias de alinhamento
- [ ] 2.5 Multi-seleção; alinhar/distribuir; z-order
- [ ] 2.6 Nudge (setas/Shift), copy/paste, delete
- [ ] 2.7 Undo/redo com histórico

## 3. Painel de propriedades
- [ ] 3.1 Todos os atributos JR do elemento
- [ ] 3.2 Herança visual (cinza-claro herdado / preto sobrescrito)
- [ ] 3.3 Filtro por nome

## 4. DataContractPanel (contract-first)
- [ ] 4.1 Declaração de fields/params/vars (escalar, objeto, array)
- [ ] 4.2 Geração de `inputSchema` via core; SEM Query Editor/JDBC/Query Preview

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
