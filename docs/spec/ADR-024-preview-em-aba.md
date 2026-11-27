# ADR-024 — Preview do engine em aba própria (supersede RFC-004 §7 "lado a lado")

- **Status:** Accepted (pedido do usuário em 2026-11-27)
- **Data:** 2026-11-27
- **Relacionado:** RFC-004 §2/§7, ADR-008 (preview), I-8 (preview honesto)
- **Implementa:** `openspec/changes/preview-em-aba`

## Contexto

A RFC-004 §7 pôs o `PreviewPanel` **lado a lado** com o canvas: uma coluna de 380px à direita do painel de
propriedades. Na prática:

- uma página A4 cabe nessa coluna com cerca de 45% do tamanho;
- paisagem (listagem de vendas) e documentos densos (DANFE, boleto) ficam ilegíveis;
- ao abrir, o painel ainda espreme o canvas.

O usuário relatou: "o preview como está tá ruim de ver".

## Decisão

1. A área de trabalho ganha duas **abas**: **Editor** (contrato, canvas, propriedades, problemas) e
   **Preview (Jasper)**, que é o render real em tela cheia.
   - Os comandos globais ficam visíveis nas duas abas: Assistente, Renderizar, Publicar e sessão.
   - As ferramentas do editor (zoom do canvas, grid, snap, inserir, alinhamento) só aparecem na aba
     Editor.
2. Aba Preview:
   - página centralizada sobre fundo neutro;
   - zoom "Ajustar à largura" (padrão), "Página inteira" e 50–200%;
   - paginação e "Renderizar novamente";
   - selo "verdade do engine" (I-8).
3. "Renderizar (Jasper)" leva à aba Preview e renderiza.
4. **Desatualização:** o preview guarda o JRXML do último render. Se o documento mudou:
   - a aba mostra "desatualizado";
   - ao entrar nela, renderiza de novo sozinha.

   O usuário nunca olha um render que não corresponde ao que está editando sem ser avisado.
5. A seleção e o estado do editor são preservados ao alternar abas, porque vivem nos stores, não na aba.

## Alternativas consideradas

- **Painel lado a lado redimensionável.** Melhora, mas A4 continua disputando largura com canvas e
  propriedades, e em telas de notebook não resolve. Rejeitada.
- **Modal/tela cheia sobre o editor.** Esconde o editor sem lugar estável para voltar, e o fluxo
  "editar → conferir → editar" fica pior que o de abas. Rejeitada.

## Consequências

- Supersede o "lado a lado" da RFC-004 §2/§7. O resto da RFC vale.
- A comparação visual editor × render passa a ser por alternância de abas, não por justaposição. A
  aproximação do canvas continua rotulada (I-8).
- Testes de componente e E2E que procuravam o painel lateral passam a usar a aba.
