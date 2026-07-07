# Change: phase-2-react-mantine-shell

## Why
A UI Vue do fork é temporária e fora do stack da casa. A Fase 2 constrói a casca React/Mantine/Archbase
sobre o `jrxml-core`, entregando o designer no ecossistema do time e permitindo embarque futuro (Gestor-RQ).
Aposenta a UI Vue.

## What Changes
- Pacote `jrxml-designer-react` (React 18 + Mantine v9 + Archbase) consumindo `jrxml-core`.
- Canvas com snapping, multi-seleção, align/distribute, réguas mm, grid, z-order, nudge, copy/paste, undo/redo.
- Painel de propriedades com herança visual (cinza-claro = herdado, preto = sobrescrito).
- `DataContractPanel` (contract-first; sem Query Editor).
- Integração do preview round-trip (botão "Renderizar (Jasper)").
- Tooltips de auto-explicação; galeria de templates iniciais pt-BR.

## Impact
- Affected specs: `designer-ui` (nova capability — base)
- Affected code: novo pacote de UI React; UI Vue marcada para remoção.
- ADRs: ADR-004, ADR-005, ADR-008. RFC: RFC-004.
- Depende de: phase-0 (core), phase-1 (endpoint de preview).
