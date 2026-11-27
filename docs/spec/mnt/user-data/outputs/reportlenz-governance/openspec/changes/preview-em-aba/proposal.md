# Change: preview-em-aba

## Why
O preview do engine num painel lateral de 380px deixa a página A4 ilegível (~45%) e espreme o canvas.
Pedido do usuário em 2026-11-27 (ADR-024).

## What Changes
- Abas **Editor** / **Preview (Jasper)** na área de trabalho; ferramentas do editor só na aba Editor.
- Preview em tela cheia com zoom (ajustar à largura, página inteira, 50–200%), paginação e "Renderizar
  novamente".
- "Renderizar (Jasper)" leva à aba Preview; render desatualizado é sinalizado e refeito ao entrar na aba.

## Impact
- Affected specs: `preview` (modificada — supersede o "lado a lado" da RFC-004 §7).
- Affected code: `jrxml-designer-react` (App, PreviewPanel → AbaDePreview, previewStore), testes de
  componente e E2E.
