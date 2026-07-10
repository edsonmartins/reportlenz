# Nota 007 — Aceite da Fase 3 (editor: features pro)

**Data:** 2026-07-10 · **Fase:** `phase-3-editor-pro-features` (tarefas 9.1/9.2)

## 1. Critérios RFC-004 §8 (features pro) — evidências

| Feature (§8) | Onde | Evidência |
| --- | --- | --- |
| Editor de tabela (add/delete/reorder, merge/split) | `EditorDeTabela` + `ColunaDeTabela` single\|group no core | `editorDeTabela.test.tsx`; merge via `column kind="group"` aceito pela Library (harness) |
| Código de barras (Code128, QR; boleto/DANFE) | menu "+ Inserir", perfis em `palette/inserir.ts` | `inserir.test.tsx` (ITF-25 103×13mm, chave 44 dígitos, QR 25mm) |
| Estilos e condicionais (`conditionalStyle`, `printWhenExpression`) | `GerenciadorDeEstilos` (zebra default) | `estilos.test.tsx`; zebra visível no render real da fatura |
| Grupos com subtotais; subreports | `GerenciadorDeGrupos` ("+ Subtotal" = variável Sum + textField) | `grupos.test.tsx`; subreport com editor de parâmetros |
| Padrões pt-BR (R$, milhar, `dd/MM/yyyy`, `blankWhenNull`) | `CampoPattern` (Autocomplete de presets) | `paginaEPatterns.test.tsx`; PDFs do §3 abaixo ("R$ 1.250,50", "15/01/2026") |
| Multi-coluna p/ etiquetas A4 (laser, ADR-011) | `printOrder` no core + aba "Página" | `paginaEPatterns.test.tsx`; grade real no §3 |
| Biblioteca de blocos reutilizáveis | `src/blocos/` (4 blocos + mescla de mini-contrato) | `blocos.test.tsx` (conflito de nomes renomeia e reescreve expressões) |

Critérios base do §10 (canvas/propriedades/expression editor/DataContractPanel/preview) foram aceitos na
Fase 2 (nota 006) e seguem verdes: **85 testes core + 114 UI + 34 render-service + harness 4/4**.

## 2. Achados do aceite (corrigidos nesta fase)

1. **Coerção de payload** (`CoercaoDePayload`, render-service): o JSON entrega `Double`/`Integer`/`String`,
   mas o fill exige a classe declarada (`BigDecimal`, `Long`, datas). Sem coerção, `$F{valor}` explodia em
   `JRExpressionEvalException`. Nenhum teste da Fase 1 preenchia um campo decimal — agora
   `ReferenciasDeQualidadeTest` cobre os 4 templates com payload realista.
2. **`java.time.LocalDate` não formata no JR 7.0.7**: `JRFillTextField.getFormat()` só aplica `pattern` a
   `java.util.Date` e `Number` — um field `LocalDate` renderiza `toString()` ISO. A classe canônica de
   `date`/`datetime` no serializer mudou para **`java.sql.Date`/`java.sql.Timestamp`** (`javaTypes.ts`);
   o parser continua aceitando `java.time.*` na leitura. Datas agora saem `dd/MM/yyyy` de verdade.
3. **Fatura de referência sem total**: o rodapé da tabela dizia "Total" sem valor. Dentro do dataset da
   tabela não há como somar — o total agora é **contract-first**: field `total` (decimal, calculado a
   montante — Push/LGPD) exibido no resumo; o rodapé da coluna aponta "(total geral no resumo)".

## 3. Templates de referência produzidos (9.2)

Renderizados de ponta a ponta pelo serviço real (`POST /render/preview`, inputSchema junto — gate 422
ativo), com inspeção visual dos PNGs e verificação de texto extraído do PDF
(`ReferenciasDeQualidadeTest`, roda no CI):

- **fatura**: zebra, tabela com merge de cabeçalho, QR, "R$ 1.250,50", "Total geral R$ 2.495,75",
  acentuação ("Padaria São João Ltda.") — 200 OK, 1 página.
- **comprovante**: grupo de colunas "Medidas" (Qtde/Unid.), data `dd/MM/yyyy`, QR do pedido — 200 OK.
- **formulario**: nascimento `21/03/1987`, booleano "Ativo", acentos em rótulos — 200 OK.
- **etiqueta_a4**: EAN-13 válido renderizado; **grade** provada com 9 registros → 3 colunas × 3 linhas
  em 1 folha A4 (printOrder Horizontal), texto de todas as 9 etiquetas presente no PDF.

## 4. Pendência registrada (precisa de ADR)

**Alimentação de grade multi-registro em modo Push:** o pipeline monta o datasource-mestre com UMA linha
(o payload é um objeto — RFC-002). Uma folha de N etiquetas exige N linhas no mestre; hoje isso só é
possível chamando o engine direto (como faz o teste de aceite). Proposta a avaliar: marcador no template
(ex.: property `reportlenz.datasource.campo` apontando um campo-coleção do contrato) com suporte
simétrico no core (serializer/validador/extractor) e no pipeline. Não foi improvisado aqui (CLAUDE.md §9).

## 5. Veredito

Fase 3 **aceita**: blocos 1–9 concluídos, gates G1–G6 verdes, CI 4/4.
Próxima fase: **Fase 4** (`phase-4-ai-governance`).
