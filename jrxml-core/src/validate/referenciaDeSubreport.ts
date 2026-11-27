/**
 * Referência de subreport ao registro de templates (ADR-020): a expressão é o
 * LITERAL `"repo:<codename>"` (versão publicada atual) ou
 * `"repo:<codename>@<n>"` (versão fixa). Só literal — o payload não escolhe o
 * template incluído e o grafo de dependências é estático.
 */
export interface ReferenciaDeSubreport {
  codename: string;
  /** Versão fixa; ausente = versão `published` atual. */
  versao?: number;
}

const REFERENCIA = /^\s*"repo:([A-Za-z0-9_.-]+)(?:@([1-9][0-9]*))?"\s*$/;

/** Lê a referência de uma `templateExpression`; null se não for o literal `repo:`. */
export function lerReferenciaDeSubreport(expressao: string | undefined): ReferenciaDeSubreport | null {
  if (expressao === undefined) return null;
  const m = REFERENCIA.exec(expressao);
  if (!m?.[1]) return null;
  return m[2] ? { codename: m[1], versao: Number(m[2]) } : { codename: m[1] };
}
