# RFC-002 — Contrato de dados (`inputSchema`) + extração + codegen

- **Status:** Draft
- **Fase:** 1
- **Relacionado:** ADR-003, ADR-009, RFC-001, RFC-003
- **Implementa:** `openspec/changes/phase-1-render-contract-first`

## 1. Objetivo

Definir o **contrato de dados** de um template: o formato do `inputSchema`, como ele é extraído do modelo
(RFC-001), como o backend valida o payload contra ele, e a geração de tipos (TS) e `record` Java a partir
dele. É a materialização do invariante I-3 (Push, contract-first).

## 2. O `inputSchema`

O contrato é serializado como **JSON Schema (draft 2020-12)**, persistido em `report_template_version.input_schema`
(jsonb, ADR-009). Exemplo para um comprovante de entrega:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "reportlenz:contract:comprovante-entrega-rq:v3",
  "type": "object",
  "required": ["pedido", "cliente", "itens"],
  "properties": {
    "pedido": {
      "type": "object",
      "required": ["numero", "data", "qrPayload"],
      "properties": {
        "numero":   { "type": "string" },
        "data":     { "type": "string", "format": "date" },
        "qrPayload":{ "type": "string" }
      }
    },
    "cliente": {
      "type": "object",
      "required": ["nome", "documento"],
      "properties": {
        "nome":      { "type": "string" },
        "documento": { "type": "string" },
        "endereco":  { "type": "string" }
      }
    },
    "itens": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["descricao", "quantidade"],
        "properties": {
          "descricao":  { "type": "string" },
          "quantidade": { "type": "number" },
          "unidade":    { "type": "string" }
        }
      }
    }
  }
}
```

### Mapeamento modelo → schema
- `field` escalar (`$F{cliente.nome}`) → propriedade tipada.
- `field` que alimenta uma `detail band`/tabela (lista) → `array` de objeto.
- `parameter` (`$P{...}`) → propriedade de topo (cabeçalho, título, logo path).
- `variable` (`$V{...}`) é **calculada pelo engine** (sum/count) e **NÃO entra no payload** — é derivada.

## 3. Extração

```ts
// jrxml-core
function buildInputSchema(contract: DataContract): JsonSchema;
```

Heurística de agrupamento: campos com prefixo comum (`cliente.nome`, `cliente.documento`) viram objeto
aninhado `cliente`; campos consumidos em `detail` viram itens de array. A UI permite ajustar a estrutura
(ex.: marcar um grupo como array de N itens).

## 4. Codegen

A partir do `inputSchema`:

```ts
function genTypeScriptTypes(schema: JsonSchema): string;  // interfaces TS p/ o front (autocomplete)
function genJavaRecord(schema: JsonSchema): string;       // record(s) Java p/ o backend montar o datasource
```

O **`record` Java** é o formato que o backend usa para montar `JRBeanCollectionDataSource`/`Map`
(RFC-003), garantindo que o payload entregue ao Jasper case com o contrato.

## 5. Validação de payload (run-time)

No serviço de render (RFC-003), **antes** de preencher o relatório:
1. Carregar o `input_schema` da versão do template.
2. Validar o payload recebido contra o schema (ex.: `ajv` no lado TS; `networknt/json-schema-validator`
   no lado Java).
3. Payload inválido → **HTTP 422** com lista de violações; **não renderiza**.

Isto é o gate de contrato em run-time (ADR-009, regra 3).

## 6. Publish Wizard (integração com UI)

Inspirado no Publish Wizard do Stimulsoft (ADR-005), ao publicar um template a UI gera o **pacote de
integração**:
- o `inputSchema` (este RFC);
- o snippet Java de como chamar o render (`POST /render/...`) com o `record` gerado;
- o registro da versão no PostgreSQL (ADR-009).

## 7. Critérios de aceite

- `buildInputSchema` produz JSON Schema válido a partir de um `DataContract`.
- Validação de payload recusa objeto que não satisfaz o contrato (422).
- Codegen TS e Java produzem artefatos compiláveis.
- Nenhum caminho do contrato envolve query/conexão (anti-Pull, I-3).
