# Change: phase-3-editor-pro-features

## Why
O básico (Fase 2) cobre texto/campo/linha/retângulo. Para faturas, etiquetas, comprovantes e formulários
comerciais com qualidade profissional, o editor precisa do expression editor com autocomplete, tabela com
merge/split, código de barras, estilos condicionais, grupos/subreports e padrões pt-BR. Esta é a fase que
separa "básico" de "produto".

## What Changes
- **Expression editor** com autocomplete sobre o contrato + validação de nomes/sintaxe (maior ganho de produtividade).
- **Editor de tabela** com add/delete/reorder de colunas e **merge/split de células** (prioridade alta).
- **Código de barras** (barcode4j: Code128, QR; perfil boleto/DANFE).
- **Estilos e estilos condicionais** (`conditionalStyle`, `printWhenExpression`).
- **Grupos** com subtotais; **subreports**.
- **Padrões pt-BR** (R$, milhar com ponto, `dd/MM/yyyy`, `blankWhenNull`).
- **Multi-coluna** p/ grade de etiquetas A4 (não térmica — ADR-011).
- **Biblioteca de blocos reutilizáveis** (cabeçalho, rodapé com totais, assinatura).

## Impact
- Affected specs: `designer-ui` (MODIFIED — features pro)
- Affected code: extensões de UI e de modelo no `jrxml-core` (tabela, grupos, subreports, conditional styles).
- RFC: RFC-004. ADR: ADR-005.
- Depende de: phase-2.
