/**
 * `extractContract` (RFC-001 §4, tarefa phase-0/7.1): projeta o contrato de
 * dados de um template para consumo da geração de `inputSchema` (RFC-002).
 *
 * A cópia é PROFUNDA e desacoplada: quem consome o contrato (gerador de
 * schema, codegen TS/Java, UI de publish) nunca segura referência ao modelo
 * mutável do designer. Variáveis vêm com sua natureza calculada explícita
 * (`calculation`/`resetType`) — são derivadas pelo engine e ficam FORA do
 * payload (RFC-002 §2).
 */
import type { DataContract, FieldDecl } from '../model/contract.js';
import type { ReportTemplate } from '../model/report.js';

function copyField(f: FieldDecl): FieldDecl {
  return {
    ...f,
    ...(f.itemFields !== undefined ? { itemFields: f.itemFields.map(copyField) } : {}),
  };
}

/** Extrai o contrato do template como cópia profunda independente. */
export function extractContract(t: ReportTemplate): DataContract {
  return {
    fields: t.dataContract.fields.map(copyField),
    parameters: t.dataContract.parameters.map((p) => ({ ...p })),
    variables: t.dataContract.variables.map((v) => ({ ...v })),
  };
}
