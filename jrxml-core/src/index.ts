/**
 * @reportlenz/jrxml-core — núcleo headless do ReportLenz (RFC-001).
 *
 * Invariantes deste pacote:
 * - I-7: TypeScript puro — sem Vue, React ou APIs de DOM.
 * - ADR-002: dialeto-alvo JRXML 7 (Library 7.0.7); 6.x é rejeitado.
 * - ADR-003: contract-first — `<queryString>` é proibido em qualquer caminho.
 *
 * A API pública (parseJrxml, serializeJrxml, validateSchema, validateContract,
 * extractContract) será exportada aqui conforme as tarefas 3–7 da Fase 0.
 */

/** Versão do dialeto JRXML alvo do parser/serializer (ADR-002). */
export const JRXML_DIALECT_TARGET = '7.0.7' as const;

// Modelo de domínio (RFC-001 §3) — tarefa phase-0/3.1.
export * from './model/index.js';

// Erros estruturados (RFC-001 §4/§6).
export type { ErrorCode, ParseError, Result, ValidationResult } from './errors.js';

// Parser JRXML 7 → modelo (RFC-001 §4-§5) — tarefa phase-0/4.1.
export { parseJrxml } from './parse/parseJrxml.js';

// Serializer modelo → JRXML 7 (RFC-001 §4-§5) — tarefa phase-0/5.1.
export { serializeJrxml } from './serialize/serializeJrxml.js';

// Validação dupla (RFC-001 §6) — tarefas phase-0/6.1-6.3.
export { validateSchema } from './validate/validateSchema.js';
export { validateContract, BUILTIN_PARAMETERS, BUILTIN_VARIABLES } from './validate/validateContract.js';

// Extração de contrato (RFC-001 §4, alimenta a RFC-002) — tarefa phase-0/7.1.
export { extractContract } from './extract/extractContract.js';

// inputSchema (RFC-002 §2-§3) — tarefas phase-1/3.1-3.2.
export { buildInputSchema } from './contract/buildInputSchema.js';
export type { BuildInputSchemaOptions, JsonSchema } from './contract/buildInputSchema.js';

// Codegen (RFC-002 §4) — tarefa phase-1/3.3.
export { genTypeScriptTypes } from './contract/genTypeScriptTypes.js';
export type { GenTypeScriptOptions } from './contract/genTypeScriptTypes.js';
export { genJavaRecord } from './contract/genJavaRecord.js';
export type { GenJavaRecordOptions } from './contract/genJavaRecord.js';

// Hash (jrxml_hash — ADR-009/G6; mesma chave do compile cache, ADR-008).
export { sha256 } from './hash/sha256.js';

// Pacote de integração do Publish Wizard (RFC-002 §6) — tarefa phase-1/3.4.
export { buildIntegrationPackage } from './publish/integrationPackage.js';
export type { IntegrationPackage, IntegrationPackageOptions, VersionRecord } from './publish/integrationPackage.js';

// Gates de governança G1–G6 no publish (RFC-006 §3, Fase 4).
export { avaliarGates } from './publish/gates.js';
export type { CodigoDeGate, ResultadoDeGate, ResultadoDosGates } from './publish/gates.js';

// Templates de referência (fixtures do harness Java e exemplos p/ o designer).
export {
  REFERENCE_TEMPLATES,
  REFERENCIA_COMPROVANTE,
  REFERENCIA_ETIQUETA_A4,
  REFERENCIA_FATURA,
  REFERENCIA_FORMULARIO,
} from './reference/templates.js';
