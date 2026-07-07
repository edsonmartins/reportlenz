# RFC-001 — `jrxml-core`: modelo de domínio, parser/serializer, validação

- **Status:** Draft
- **Fase:** 0
- **Relacionado:** ADR-002, ADR-004, ADR-003
- **Implementa:** `openspec/changes/phase-0-extract-jrxml-core`

## 1. Objetivo

Especificar o pacote `jrxml-core`: a biblioteca TypeScript headless, framework-agnóstica, que é o ativo
durável de ReportLenz. Contém o modelo de domínio do relatório, o parser (JRXML 7 → modelo), o serializer
(modelo → JRXML 7), o validador (XSD + contrato) e o extrator de contrato de dados.

## 2. Princípios

- **Headless** (I-7): sem Vue, sem React, sem DOM. Apenas TS + parser XML.
- **Dialeto-alvo JRXML 7** (ADR-002): o serializer emite JRXML 7; o parser lê JRXML 7. Entrada 6.x está
  fora de escopo (rejeitada com erro claro).
- **Determinístico**: `serialize(parse(jrxml)) ≈ jrxml` (idempotência de round-trip, normalizada).
- **Contract-first** (ADR-003): o parser rejeita `<queryString>`; o extrator de contrato lê
  `<field>/<parameter>/<variable>`.

## 3. Modelo de domínio (esboço de tipos)

```ts
// Documento JRXML
interface ReportTemplate {
  name: string;
  pageFormat: PageFormat;          // A4, custom, margens, colunas (multi-col p/ etiquetas A4)
  properties: Record<string,string>;
  styles: Style[];                 // estilos nomeados + conditionalStyle
  dataContract: DataContract;      // fields/parameters/variables (NÃO query)
  bands: BandSet;                  // title, pageHeader, columnHeader, detail[], groups[], ...
}

interface BandSet {
  title?: Band; background?: Band;
  pageHeader?: Band; columnHeader?: Band;
  detail: Band[];                  // múltiplas detail bands
  columnFooter?: Band; pageFooter?: Band; summary?: Band;
  noData?: Band;
  groups: Group[];                 // groupHeader/groupFooter por grupo
}

interface Band { height: number; splitType: 'Stretch'|'Prevent'|'Immediate'; elements: Element[]; printWhenExpression?: string; }

type Element =
  | StaticText | TextField | Line | Rectangle | Ellipse
  | ImageElement | BarcodeElement | SubreportElement | FrameElement | TableElement;

interface TextField {
  kind: 'textField';
  bounds: Bounds;                  // x,y,width,height em pt (72dpi)
  expression: string;              // $F{...} / $P{...} / $V{...}
  pattern?: string;                // formatação pt-BR (R$, dd/MM/yyyy)
  blankWhenNull?: boolean;
  styleRef?: string;
  conditionalStyles?: ConditionalStyle[];
}

interface Group { name: string; expression: string; header?: Band; footer?: Band; }

// Contrato de dados (ADR-003 / RFC-002)
interface DataContract {
  fields: FieldDecl[];             // { name, type, description? }
  parameters: ParamDecl[];
  variables: VariableDecl[];       // calculados (sum, count, etc.) — não entram no payload
}
```

## 4. API pública

```ts
// Parse
function parseJrxml(xml: string): Result<ReportTemplate, ParseError[]>;

// Serialize (emite JRXML 7)
function serializeJrxml(t: ReportTemplate): string;

// Validação dupla
function validateSchema(xml: string): ValidationResult;        // contra jasperreports.xsd (7.x)
function validateContract(t: ReportTemplate): ValidationResult; // expressões referenciam contrato; sem queryString

// Extração de contrato -> alimenta RFC-002
function extractContract(t: ReportTemplate): DataContract;
```

`Result`/`ValidationResult` carregam mensagens estruturadas (linha/coluna/elemento) para alimentar o
"Report Checker" da UI (ADR-005).

## 5. Estratégia de parser/serializer

- **Parser**: XML → AST → modelo de domínio. Usa um parser XML robusto (ex.: `fast-xml-parser`) preservando
  ordem de atributos onde o engine for sensível.
- **Serializer**: modelo → XML na **ordem de elementos/atributos que a Library 7 aceita**. O JR7 trocou os
  parsers Digester por Jackson XML — validar o output contra o `jasperreports.xsd` da 7.0.7.
- **Round-trip tests** (Vitest): conjunto de JRXMLs 7 de referência; `serialize(parse(x))` deve validar e
  ser semanticamente equivalente.

## 6. Validação

1. **XSD 7**: bem-formado e válido contra o esquema da 7.0.7.
2. **Anti-Pull** (ADR-003): presença de `<queryString>` → erro `CONTRACT_PULL_FORBIDDEN`.
3. **Integridade de expressão**: toda `$F{x}/$P{x}/$V{x}` referencia declaração existente no contrato →
   erro `EXPR_UNKNOWN_REF` com nome e localização.
4. **Compat de versão**: atributos/elementos exclusivos de 6.x → erro `LEGACY_DIALECT`.

## 7. Caveats

- Confirmar o dialeto do fork de origem; se 6.x, o serializer é majoritariamente novo (ADR-004 caveat).
- Charts 3D não são suportados no JR7 (ADR-007) — o modelo não deve oferecer Pie/Bar 3D.
- O esquema completo do JRXML 7 é extenso (elementos têm centenas de propriedades); a Fase 0 cobre o
  **subconjunto** necessário para faturas/comprovantes/formulários/etiquetas A4; o resto é incremental.

## 8. Critérios de aceite (resumo)

- Parse + serialize round-trip validando contra XSD 7 para os JRXMLs de referência.
- `validateContract` recusa `<queryString>` e expressões órfãs.
- `extractContract` produz `DataContract` consumível pela RFC-002.
- Zero dependência de framework de UI no bundle.
