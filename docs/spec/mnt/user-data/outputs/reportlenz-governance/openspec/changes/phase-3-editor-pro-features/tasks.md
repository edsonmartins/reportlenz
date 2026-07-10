# Tasks — phase-3-editor-pro-features

## 1. Expression editor
- [x] 1.1 Autocomplete sobre fields/params/vars do contrato (`$F{`, `$P{`, `$V{`) — incl. built-ins e `{grupo}_COUNT`
- [x] 1.2 Validação de sintaxe e de nomes referenciados (erro inline + ReportChecker no commit)
- [x] 1.3 Suporte a funções (`jasperreports-functions`) — catálogo de 20 funções com assinatura/descrição pt-BR

## 2. Tabela
- [ ] 2.1 Componente de tabela no modelo (`jrxml-core`) + UI
- [ ] 2.2 Add/delete/reorder de colunas
- [ ] 2.3 Merge/split de células; seções (header/detail/footer)
- [ ] 2.4 Binding de coluna ao contrato (array)

## 3. Código de barras
- [ ] 3.1 Elemento barcode (barcode4j): Code128, QR
- [ ] 3.2 Perfil boleto/DANFE

## 4. Estilos
- [ ] 4.1 Estilos nomeados + herança
- [ ] 4.2 `conditionalStyle` e `printWhenExpression` (destacar linhas/condições)

## 5. Grupos e subreports
- [ ] 5.1 Grupos com groupHeader/groupFooter e subtotais
- [ ] 5.2 Subreports (fatura: itens + impostos em sub-relatório), com contrato do subreport

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
