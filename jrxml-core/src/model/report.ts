/**
 * Raiz do modelo de domínio: o template de relatório (RFC-001 §3).
 *
 * Nota deliberada: NÃO existe campo para query/conexão. O binding é
 * contract-first (ADR-003) — `<queryString>` é rejeitado no parse com
 * `CONTRACT_PULL_FORBIDDEN` (tarefa 4.3).
 */
import type { BandSet } from './bands.js';
import type { DataContract } from './contract.js';
import type { PageFormat } from './primitives.js';
import type { Style } from './styles.js';

/** Documento JRXML como modelo de domínio. */
export interface ReportTemplate {
  name: string;
  pageFormat: PageFormat;
  /** Propriedades `<property>` do relatório (chave → valor). */
  properties: Record<string, string>;
  styles: Style[];
  /** O que o relatório espera do payload (Push) — nunca de onde vem (ADR-003). */
  dataContract: DataContract;
  bands: BandSet;
}
