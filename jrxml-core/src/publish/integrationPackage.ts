/**
 * Pacote de integração do Publish Wizard (RFC-002 §6, tarefa phase-1/3.4 —
 * esboço): tudo que o time consumidor precisa para integrar um template
 * publicado, gerado de uma vez a partir do modelo.
 *
 * A UI da Fase 2 apresenta isso como wizard; a persistência do registro no
 * PostgreSQL (ADR-009) é feita pelo backend no publish — aqui produzimos os
 * DADOS do registro, incluindo o `jrxml_hash` (G6), que coincide com a chave
 * do compile cache do render (ADR-008).
 */
import { buildInputSchema } from '../contract/buildInputSchema.js';
import type { JsonSchema } from '../contract/buildInputSchema.js';
import { genJavaRecord } from '../contract/genJavaRecord.js';
import { genTypeScriptTypes } from '../contract/genTypeScriptTypes.js';
import { extractContract } from '../extract/extractContract.js';
import { sha256 } from '../hash/sha256.js';
import type { DataContract } from '../model/contract.js';
import type { ReportTemplate } from '../model/report.js';
import { serializeJrxml } from '../serialize/serializeJrxml.js';

export interface IntegrationPackageOptions {
  /** Versão publicada do template (ADR-009). */
  version: number;
  /** Base URL do serviço de render (default: http://localhost:8087). */
  baseUrl?: string;
  /** Package Java dos records gerados (default: dev.reportlenz.contrato). */
  packageName?: string;
}

/** Dados do registro de versão (persistidos no publish — ADR-009). */
export interface VersionRecord {
  templateName: string;
  version: number;
  /** sha256 do JRXML publicado — G6; chave do compile cache (ADR-008). */
  jrxmlHash: string;
  inputSchemaId?: string;
  contract: DataContract;
}

export interface IntegrationPackage {
  registro: VersionRecord;
  jrxml: string;
  inputSchema: JsonSchema;
  tsTypes: string;
  javaRecord: string;
  /** Snippet Java de chamada ao serviço de render com o record gerado. */
  javaSnippet: string;
}

function pascal(nome: string): string {
  return nome
    .split(/[^A-Za-z0-9]+/)
    .filter((p) => p.length > 0)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
}

function snippetJava(rootName: string, templateName: string, version: number, baseUrl: string): string {
  return `// Integração com o ReportLenz — template "${templateName}" v${version}
// O payload é o CONTRATO: monte o record gerado (validação de tipos em compile-time).
// O serviço valida contra o inputSchema antes de renderizar (422 se não satisfaz).

var payload = new ${rootName}(/* ... campos do contrato ... */);

// Preview (síncrono — PDF):
var pdf = restClient.post()
    .uri("${baseUrl}/render/preview")
    .body(java.util.Map.of("jrxml", jrxml, "sampleData", payload, "format", "pdf"))
    .retrieve()
    .body(byte[].class);

// Produção em lote (assíncrono e idempotente):
var job = restClient.post()
    .uri("${baseUrl}/render/batch")
    .body(java.util.Map.of(
        "templateId", TEMPLATE_ID,
        "version", ${version},
        "payloads", java.util.List.of(payload),
        "idempotencyKey", "meu-lote-2026-07"))
    .retrieve()
    .body(JobResponse.class);
`;
}

/** Monta o pacote de integração completo de um template (Publish Wizard). */
export function buildIntegrationPackage(template: ReportTemplate, options: IntegrationPackageOptions): IntegrationPackage {
  const contract = extractContract(template);
  const jrxml = serializeJrxml(template);
  const inputSchema = buildInputSchema(contract, { templateName: template.name, version: options.version });
  const rootName = `${pascal(template.name)}Payload`;
  const baseUrl = options.baseUrl ?? 'http://localhost:8087';
  const packageName = options.packageName ?? 'dev.reportlenz.contrato';

  return {
    registro: {
      templateName: template.name,
      version: options.version,
      jrxmlHash: sha256(jrxml),
      ...(inputSchema.$id !== undefined ? { inputSchemaId: inputSchema.$id } : {}),
      contract,
    },
    jrxml,
    inputSchema,
    tsTypes: genTypeScriptTypes(inputSchema, { rootName }),
    javaRecord: genJavaRecord(inputSchema, { rootName, packageName }),
    javaSnippet: snippetJava(rootName, template.name, options.version, baseUrl),
  };
}
