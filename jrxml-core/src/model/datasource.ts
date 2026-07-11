/**
 * Grade multi-registro em modo Push (ADR-015, change grade-multiregistro-push).
 *
 * A property `reportlenz.datasource.campo` aponta o campo-coleção do contrato
 * que alimenta o datasource-MESTRE: um item = uma linha (etiqueta/crachá).
 * Sem a property, nada muda (um payload = um registro-mestre, como sempre).
 * Continua Push puro (I-3): a property referencia o CONTRATO, nunca fonte
 * de dados.
 */
import type { FieldDecl } from './contract.js';
import type { ReportTemplate } from './report.js';

export const PROPRIEDADE_DATASOURCE = 'reportlenz.datasource.campo';

/** Nome do campo-coleção que alimenta o mestre (undefined = registro único). */
export function datasourceCampo(t: ReportTemplate): string | undefined {
  const valor = t.properties[PROPRIEDADE_DATASOURCE];
  return valor === undefined || valor === '' ? undefined : valor;
}

/** Declaração da coleção-datasource no contrato (undefined se ausente/inválida). */
export function colecaoDoDatasource(t: ReportTemplate): FieldDecl | undefined {
  const campo = datasourceCampo(t);
  if (campo === undefined) return undefined;
  const decl = t.dataContract.fields.find((f) => f.name === campo);
  return decl?.type === 'collection' ? decl : undefined;
}
