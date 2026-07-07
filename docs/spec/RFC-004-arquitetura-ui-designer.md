# RFC-004 — Arquitetura da UI do designer

- **Status:** Draft
- **Fase:** 2 / 3
- **Relacionado:** ADR-004, ADR-005, ADR-008, RFC-001, RFC-002
- **Implementa:** `phase-2-react-mantine-shell`, `phase-3-editor-pro-features`

## 1. Objetivo

Especificar a casca React/Mantine/Archbase (`jrxml-designer-react`) que consome o `jrxml-core`. Cobre a
arquitetura de componentes, o modelo de interação do canvas, o painel de propriedades, o expression editor
e a integração do preview.

## 2. Arquitetura de componentes

```
<DesignerApp>
  <Toolbar/>                 // ações: novo, salvar, publicar, renderizar (Jasper), undo/redo, align/distribute
  <Palette/>                 // elementos arrastáveis (texto, campo, tabela, imagem, barcode, linha, ret., subreport, frame)
  <Canvas>                   // página A4/custom em pt; réguas mm/cm; grid; snap; multi-col p/ etiqueta
    <Band/>*                 // bandas (title..summary, groups); resize de altura
      <CanvasElement/>*      // elemento selecionável/movível/resizable
  </Canvas>
  <PropertiesPanel/>         // todos os atributos JR do elemento selecionado
  <DataContractPanel/>       // contract-first: declara fields/params/vars (NÃO query)
  <ReportChecker/>           // painel de problemas (validação XSD + contrato)
  <PreviewPanel/>            // aproximação (browser) + render real (Jasper) lado a lado
</DesignerApp>
```

Estado do documento = instância de `ReportTemplate` (RFC-001) mantida em store React (sem browser storage;
ver restrições de artifacts). Toda mutação passa pelo `jrxml-core` (validação contínua).

## 3. Interação de canvas (Fase 2/3)

- **Snapping** com guias de alinhamento inteligentes (prioridade alta — roadmap do Web Studio).
- **Multi-seleção**, agrupar, **alinhar e distribuir** (toolbar).
- **Réguas em mm/cm** além de pt (o relatório raciocina em pt a 72dpi; o usuário pensa em mm).
- **Grid** com snap configurável.
- **z-order / camadas**.
- **Nudge por teclado** (setas 1px; Shift 10px), **copy/paste**, **delete**.
- **Undo/redo** com histórico (referência de UX: cakahlul/report-designer).
- **Handles de resize de banda**.

## 4. Painel de propriedades

- Expõe **todos** os atributos JR do elemento: bounds, border, padding, stretch behavior, alinhamento,
  `pattern`, `blankWhenNull`, `styleRef`, `printWhenExpression`, `conditionalStyles`.
- **Herança visual** (padrão Jaspersoft Studio): valor herdado/calculado em **cinza-claro**, valor real
  sobrescrito em **preto** — o usuário vê de imediato o que é default.
- Filtro de propriedades por nome (search box).

## 5. Expression editor (maior ganho de produtividade — Fase 3)

- **Autocomplete sobre o contrato**: campos/parâmetros/variáveis declarados no `DataContractPanel`
  (RFC-002). Digitar `$F{` lista os fields disponíveis.
- **Validação em tempo real**: sintaxe + nomes referenciados. `$F{x}` inválido se `x` não está no contrato
  → marca erro inline e alimenta o ReportChecker.
- Suporte a `$P{}`, `$V{}`, operadores e funções (`jasperreports-functions`).
- (Fase 4) assistente NL→expressão (RFC-005).

## 6. DataContractPanel (contract-first — Fase 1/2)

- Em vez de "qual query?", pergunta **"quais campos este relatório espera e de que tipo?"** (ADR-003).
- Permite declarar estrutura (escalar, objeto aninhado, array para tabelas/detail).
- Gera o `inputSchema` (RFC-002) via `jrxml-core`.
- **Nunca** oferece Query Editor, conexão JDBC ou Query Preview.

## 7. Preview (ADR-008)

- **Aproximação** desenhada pelo canvas, **rotulada como aproximação**.
- Botão **"Renderizar (Jasper)"** → `POST /render/preview` (RFC-003) com JRXML + dados de exemplo →
  PDF/PNG no `PreviewPanel` lado a lado. É a verdade do engine.

## 8. Features pro (Fase 3)

- **Editor de tabela** com add/delete/reorder de colunas e **merge/split de células** (prioridade alta —
  fatura é tabela).
- **Código de barras** (barcode4j: Code128, QR; perfil para boleto/DANFE).
- **Estilos e estilos condicionais** (`conditionalStyle`, `printWhenExpression`).
- **Grupos** com subtotais; **subreports**.
- **Padrões pt-BR** (R$, milhar com ponto, `dd/MM/yyyy`, `blankWhenNull`).
- **Multi-coluna** p/ grade de etiquetas A4 (não térmica — ADR-011).
- **Biblioteca de blocos reutilizáveis** (cabeçalho timbrado, rodapé com totais, bloco de assinatura).

## 9. Auto-explicação (UX — Stimulsoft)

Tooltips explicativos em quase todos os controles, para uso por clientes (Rio Quality/Marra) sem
treinamento. **Galeria de templates iniciais** pt-BR no "novo template".

## 10. Critérios de aceite

- Canvas com snapping, multi-seleção, align/distribute, undo/redo, réguas mm.
- Propriedades com herança visual.
- Expression editor com autocomplete e validação contra o contrato.
- DataContractPanel sem qualquer caminho de Pull.
- Preview real via endpoint Jasper.
