# ADR-023 — Posição do texto legível dos códigos de barras lineares

- **Status:** Accepted (pedido do usuário em 2026-11-27)
- **Data:** 2026-11-27
- **Relacionado:** ADR-022 (limitação conhecida), ADR-002 (dialeto 7), RFC-001 §3 (elementos)
- **Implementa:** `openspec/changes/barcode-texto-legivel`

## Contexto

O barcode4j imprime o conteúdo do código sob as barras, no "texto legível" (*human-readable text*). O
modelo do `jrxml-core` não tinha como controlar isso. No DANFE, a chave de 44 dígitos impressa sob o
CODE-128 é mais larga que o quadro e sai **cortada nas pontas**: um número de chave errado na folha,
embora as barras sejam lidas corretamente. O boleto tem o mesmo texto sob o I2of5, que a ficha de
compensação não usa. A ADR-022 registrou o problema como limitação conhecida.

Verificação na JasperReports Library 7.0.7:

- os componentes lineares (`Barcode4jComponent`: Code128, Code39, EAN-13, EAN-8, Interleaved 2 of 5,
  DataMatrix, PDF417) têm o atributo `textPosition`;
- os valores aceitos são `none`, `bottom` e `top` (`TextPositionEnum`);
- no JRXML 7 o atributo fica no `<component kind="barcode4j:…" textPosition="none">`, e o `JRXmlLoader` o
  lê (verificado);
- o `QRCode` **não** é `Barcode4jComponent` e não tem o atributo.

## Decisão

1. O `BarcodeElement` ganha `textPosition?: 'none' | 'bottom' | 'top'`.
   - Ausente: o default do engine, que é texto embaixo. Templates existentes não mudam, e o round-trip
     segue idêntico.
   - Parser e serializer leem e emitem o atributo no `<component>`.
2. O atributo só vale para as simbologias **lineares** do modelo: Code128, Code39, EAN13, EAN8 e
   Interleaved2Of5.
   - Em QRCode, DataMatrix e PDF417, o `validateContract`/estrutural acusa `INVALID_ATTRIBUTE`. Esses
     códigos não têm texto legível no barcode4j, e no QR o engine nem aceita o atributo.
3. Designer:
   - o painel de propriedades oferece "Texto legível: abaixo / acima / sem texto" para as lineares;
   - a aproximação do canvas mostra a posição;
   - trocar para uma simbologia 2D remove o atributo.
4. Os modelos de referência usam `textPosition: 'none'`:
   - **DANFE:** a chave já vem formatada em 11 blocos logo abaixo, como o MOC exige;
   - **boleto:** a linha digitável é a representação numérica da ficha.

   Os cenários passam a exigir que o número cru **não** apareça no PDF: o texto sob as barras sumiu, não
   apenas foi deslocado.

## Alternativas consideradas

- **Encolher a fonte ou alargar o quadro do DANFE.** O texto continuaria redundante com a chave
  formatada e dependeria da largura do barcode4j. Rejeitada.
- **Expor `moduleWidth`/`quietZone` junto.** Não resolve o problema relatado e amplia a superfície sem
  pedido. Fica para quando houver caso de uso.

## Consequências

- O limite registrado na ADR-022 deixa de existir.
- A imagem de referência do E2E muda para DANFE e boleto (diff revisado no PR).
- O G7 não é afetado: o atributo não é expressão.
