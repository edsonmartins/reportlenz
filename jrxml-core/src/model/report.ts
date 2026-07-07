/**
 * Raiz do modelo de domínio: o template de relatório (RFC-001 §3).
 *
 * Nota deliberada: NÃO existe campo para query/conexão. O binding é
 * contract-first (ADR-003) — `<queryString>` é rejeitado no parse com
 * `CONTRACT_PULL_FORBIDDEN` (tarefa 4.3).
 */
import type { BandSet } from './bands.js';
import type { PageFormat } from './primitives.js';
import type { Style } from './styles.js';

/** Documento JRXML como modelo de domínio. */
export interface ReportTemplate {
  name: string;
  pageFormat: PageFormat;
  /** Propriedades `<property>` do relatório (chave → valor). */
  properties: Record<string, string>;
  styles: Style[];
  // TODO(phase-0/3.2): dataContract: DataContract — declarações de
  // field/parameter/variable (contrato Push, RFC-002). Entra na tarefa 3.2.
  bands: BandSet;
}
