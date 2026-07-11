/**
 * Gates de governança G1–G6 no publish (RFC-006 §3, tarefas phase-4/4.1-4.3).
 *
 * Esta é a avaliação de DESIGN-TIME (TypeScript): G1 aqui é a aproximação
 * estrutural (ADR-013 — não existe XSD oficial da 7.0.7); a autoridade final
 * do G1 é o load+compile pela Library real, exposto pelo render-service em
 * `POST /publish/verificar`. Publish só prossegue com TODOS os gates verdes
 * nas duas camadas ("Pass 5 = autoridade sobre done", I-5).
 */
import { buildInputSchema } from '../contract/buildInputSchema.js';
import type { JsonSchema } from '../contract/buildInputSchema.js';
import type { ParseError } from '../errors.js';
import { sha256 } from '../hash/sha256.js';
import type { ReportTemplate } from '../model/report.js';
import { serializeJrxml } from '../serialize/serializeJrxml.js';
import { validateContract } from '../validate/validateContract.js';
import { validateSchema } from '../validate/validateSchema.js';

export type CodigoDeGate = 'G1' | 'G2' | 'G3' | 'G4' | 'G5' | 'G6';

export interface ResultadoDeGate {
  gate: CodigoDeGate;
  titulo: string;
  verde: boolean;
  erros: ParseError[];
}

export interface ResultadoDosGates {
  /** true somente com G1–G6 todos verdes (RFC-006 §3: publish bloqueado). */
  verde: boolean;
  gates: ResultadoDeGate[];
  /** JRXML serializado (vazio se a serialização falhou — G1 vermelho). */
  jrxml: string;
  /** sha256 do JRXML (G6; chave do compile cache — ADR-008). */
  jrxmlHash: string;
  inputSchema: JsonSchema | null;
}

const TITULOS: Record<CodigoDeGate, string> = {
  G1: 'Dialeto 7 aceito (estrutural; a Library confirma no publish)',
  G2: 'Anti-Pull — sem query/conexão embutida',
  G3: 'Integridade de expressão — $F/$P/$V referenciam o contrato',
  G4: 'Dialeto — sem construções 6.x',
  G5: 'Contrato presente — inputSchema gerado',
  G6: 'Hash — jrxml_hash recalculado e consistente',
};

function gate(codigo: CodigoDeGate, erros: ParseError[]): ResultadoDeGate {
  return { gate: codigo, titulo: TITULOS[codigo], verde: erros.length === 0, erros };
}

/**
 * Avalia os seis gates sobre o template. `hashEsperado` (quando a versão
 * anterior/registro informa) liga a checagem de consistência do G6 —
 * divergência = template mudou sem nova versão (`HASH_MISMATCH`).
 */
export function avaliarGates(
  template: ReportTemplate,
  opcoes: { hashEsperado?: string } = {},
): ResultadoDosGates {
  let jrxml = '';
  const errosDeSerializacao: ParseError[] = [];
  try {
    jrxml = serializeJrxml(template);
  } catch (e) {
    errosDeSerializacao.push({
      code: 'XML_MALFORMED',
      message: `serialização falhou: ${e instanceof Error ? e.message : String(e)}`,
      path: '',
    });
  }

  const estruturais = jrxml ? validateSchema(jrxml).messages : [];
  const porCodigo = (codes: string[]) => estruturais.filter((m) => codes.includes(m.code));

  // G2 e G4 têm códigos dedicados; o restante estrutural é a aproximação do G1.
  const g2 = porCodigo(['CONTRACT_PULL_FORBIDDEN']);
  const g4 = porCodigo(['LEGACY_DIALECT']);
  const g1 = [
    ...errosDeSerializacao,
    ...estruturais.filter((m) => m.code !== 'CONTRACT_PULL_FORBIDDEN' && m.code !== 'LEGACY_DIALECT'),
  ];

  // Modelo pode vir de fonte NÃO confiável (draft de IA): exceção do
  // validador vira erro de gate, nunca crash (achado do spike phase-4/1.1).
  let g3: ParseError[];
  try {
    g3 = validateContract(template).messages;
  } catch (e) {
    g3 = [{
      code: 'XML_MALFORMED',
      message: `validação de contrato falhou: ${e instanceof Error ? e.message : String(e)}`,
      path: '',
    }];
  }

  // G5: contrato vazio = relatório sem binding — nada a publicar como contrato.
  const contrato = template.dataContract;
  const semContrato = contrato.fields.length === 0 && contrato.parameters.length === 0;
  const g5: ParseError[] = semContrato
    ? [{ code: 'INVALID_ATTRIBUTE', message: 'CONTRACT_MISSING: contrato sem fields/parameters — declare o que o relatório espera', path: 'dataContract' }]
    : [];
  const inputSchema = semContrato ? null : buildInputSchema(contrato);

  // G6: recalcula sempre; compara quando um hash de referência é informado.
  const jrxmlHash = jrxml ? sha256(jrxml) : '';
  const g6: ParseError[] =
    opcoes.hashEsperado !== undefined && opcoes.hashEsperado !== jrxmlHash
      ? [{ code: 'INVALID_ATTRIBUTE', message: `HASH_MISMATCH: jrxml_hash divergente (esperado ${opcoes.hashEsperado.slice(0, 12)}…, recalculado ${jrxmlHash.slice(0, 12)}…) — o conteúdo mudou; publique como NOVA versão`, path: '' }]
      : [];

  const gates = [gate('G1', g1), gate('G2', g2), gate('G3', g3), gate('G4', g4), gate('G5', g5), gate('G6', g6)];
  return { verde: gates.every((g) => g.verde), gates, jrxml, jrxmlHash, inputSchema };
}
