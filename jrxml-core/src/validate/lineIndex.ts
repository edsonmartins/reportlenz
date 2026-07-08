/**
 * Índice caminho → linha/coluna do XML de origem (tarefa phase-0/6.3).
 *
 * Percorre o XML com um scanner leve (ciente de CDATA/comentários/PI) e
 * registra a posição de abertura de cada elemento, com caminhos na MESMA
 * convenção do parser: tags repetíveis (`element`, `band`, `field`, ...)
 * ganham índice `[n]` por pai; as demais ficam sem índice.
 */

/** Tags indexadas por posição — deve espelhar ARRAY_TAGS do parser. */
const INDEXED_TAGS = new Set([
  'property',
  'style',
  'conditionalStyle',
  'parameter',
  'field',
  'variable',
  'group',
  'band',
  'element',
  'dataset',
  'column',
]);

export interface SourcePosition {
  line: number;
  column: number;
}

/** Constrói o índice caminho → posição de abertura da tag. */
export function buildLineIndex(xml: string): Map<string, SourcePosition> {
  const index = new Map<string, SourcePosition>();

  // Offsets de início de linha para converter offset → linha/coluna.
  const lineStarts: number[] = [0];
  for (let i = 0; i < xml.length; i++) {
    if (xml[i] === '\n') lineStarts.push(i + 1);
  }
  const positionOf = (offset: number): SourcePosition => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if ((lineStarts[mid] as number) <= offset) lo = mid;
      else hi = mid - 1;
    }
    return { line: lo + 1, column: offset - (lineStarts[lo] as number) + 1 };
  };

  interface Frame {
    path: string;
    counters: Map<string, number>;
  }
  const stack: Frame[] = [{ path: '', counters: new Map() }];

  let i = 0;
  while (i < xml.length) {
    const lt = xml.indexOf('<', i);
    if (lt === -1) break;

    // Seções sem estrutura de elemento: pular por inteiro.
    if (xml.startsWith('<!--', lt)) {
      const end = xml.indexOf('-->', lt);
      i = end === -1 ? xml.length : end + 3;
      continue;
    }
    if (xml.startsWith('<![CDATA[', lt)) {
      const end = xml.indexOf(']]>', lt);
      i = end === -1 ? xml.length : end + 3;
      continue;
    }
    if (xml.startsWith('<?', lt) || xml.startsWith('<!', lt)) {
      const end = xml.indexOf('>', lt);
      i = end === -1 ? xml.length : end + 1;
      continue;
    }

    // Fim da tag respeitando aspas em valores de atributo.
    let j = lt + 1;
    let quote: string | undefined;
    while (j < xml.length) {
      const ch = xml[j];
      if (quote !== undefined) {
        if (ch === quote) quote = undefined;
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (ch === '>') {
        break;
      }
      j++;
    }
    const inner = xml.slice(lt + 1, j);
    i = j + 1;

    if (inner.startsWith('/')) {
      // Tag de fechamento.
      if (stack.length > 1) stack.pop();
      continue;
    }

    const selfClosing = inner.endsWith('/');
    const tagMatch = /^[A-Za-z_][\w.:-]*/.exec(inner);
    if (!tagMatch) continue;
    const tag = tagMatch[0];

    const parent = stack[stack.length - 1] as Frame;
    let path: string;
    if (INDEXED_TAGS.has(tag)) {
      const n = parent.counters.get(tag) ?? 0;
      parent.counters.set(tag, n + 1);
      path = parent.path === '' ? tag : `${parent.path}/${tag}[${n}]`;
    } else {
      path = parent.path === '' ? tag : `${parent.path}/${tag}`;
    }
    index.set(path, positionOf(lt));

    if (!selfClosing) {
      stack.push({ path, counters: new Map() });
    }
  }

  return index;
}
