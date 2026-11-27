# Change: barcode-texto-legivel

## Why
No DANFE, a chave impressa pelo barcode4j sob o CODE-128 sai cortada nas pontas. O modelo não tinha
como ocultar ou posicionar o texto legível (limitação da ADR-022). Pedido do usuário em 2026-11-27
(ADR-023).

## What Changes
- `BarcodeElement.textPosition` (`none` | `bottom` | `top`), só para simbologias lineares; parser,
  serializer e validação.
- Designer: controle "Texto legível" no painel de propriedades e na aproximação do canvas.
- DANFE e boleto com `textPosition: 'none'`; cenários exigem a ausência do número cru no PDF; imagens de
  referência atualizadas.

## Impact
- Affected specs: `elementos` (modificada); `catalogo-de-modelos` (DANFE/boleto).
- Affected code: `jrxml-core` (model/parse/serialize/validate/reference), designer (props/canvas), fixtures
  e referências do E2E.
- Depende de: `variacoes-de-templates`.
