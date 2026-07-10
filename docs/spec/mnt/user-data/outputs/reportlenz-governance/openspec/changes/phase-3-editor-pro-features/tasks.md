# Tasks — phase-3-editor-pro-features

## 1. Expression editor
- [x] 1.1 Autocomplete sobre fields/params/vars do contrato (`$F{`, `$P{`, `$V{`) — incl. built-ins e `{grupo}_COUNT`
- [x] 1.2 Validação de sintaxe e de nomes referenciados (erro inline + ReportChecker no commit)
- [x] 1.3 Suporte a funções (`jasperreports-functions`) — catálogo de 20 funções com assinatura/descrição pt-BR

## 2. Tabela
- [x] 2.1 Componente de tabela no modelo (`jrxml-core`, desde a Fase 0) + UI (EditorDeTabela no painel)
- [x] 2.2 Add/delete/reorder de colunas (grupos movem como unidade)
- [x] 2.3 Merge/split via grupos de coluna (`column kind="group"` do JR7 — modelo/parser/serializer/validador; aceito pela Library no harness); seções H/F por coluna
- [x] 2.4 Binding de coluna ao contrato: nova coluna nasce ligada a um itemField (header + `$F{campo}` + pattern por tipo)

## 3. Código de barras
- [x] 3.1 Elemento barcode (barcode4j): Code128, QR (modelo/parser/serializer desde a Fase 0; edição no painel desde a Fase 2; inserção via menu "+ Inserir")
- [x] 3.2 Perfil boleto/DANFE: presets pt-BR com dimensões dos padrões (boleto ITF-25 103×13mm FEBRABAN; DANFE Code128 80×12mm com chave de 44 dígitos; QR NFC-e/Pix 25mm) — menu Inserir também cobre os básicos (pendência da paleta encerrada)

## 4. Estilos
- [x] 4.1 Estilos nomeados + herança (GerenciadorDeEstilos no painel direito sem seleção; criar/editar/remover; default exclusivo; pai via select)
- [x] 4.2 `conditionalStyle` (zebra por padrão; expression editor no conditionExpression; overrides de fundo/negrito) e `printWhenExpression` (no painel de elemento desde a Fase 2, com expression editor desde o bloco 1)

## 5. Grupos e subreports
- [x] 5.1 Grupos com groupHeader/groupFooter e subtotais (aba Grupos no painel de documento; "+ Subtotal" cria variável Sum com reset no grupo + textField no rodapé em um clique)
- [x] 5.2 Subreports com contrato do filho: editor de parâmetros no painel (add/remove/editar expressões com autocomplete) + preset "Sub-relatório" no Inserir

## 6. Padrões pt-BR
- [ ] 6.1 `pattern` R$, milhar com ponto, `dd/MM/yyyy`; `blankWhenNull`
- [ ] 6.2 Validar acentuação no PDF (com `jasperreports-fonts`)

## 7. Etiquetas A4 multi-coluna
- [ ] 7.1 Print order + columns para grade de etiquetas (laser; NÃO térmica — ADR-011)

## 8. Biblioteca de blocos
- [ ] 8.1 Blocos reutilizáveis (cabeçalho timbrado, rodapé com totais, assinatura, QR de pedido)
- [ ] 8.2 Mescla de mini-contrato do bloco ao contrato do template (conflito de nomes)

## 9. Aceite
- [ ] 9.1 Critérios RFC-004 §10 (features pro) verdes
- [ ] 9.2 Fatura/comprovante/etiqueta A4 de referência produzidos com qualidade
