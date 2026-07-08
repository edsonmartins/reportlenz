/**
 * Emite os templates de referência como .jrxml para o harness Java (5.2).
 * Requer `pnpm build` antes (importa de dist/).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REFERENCE_TEMPLATES, serializeJrxml } from '../dist/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '../../tools/jr7-harness/fixtures');
mkdirSync(outDir, { recursive: true });

for (const [name, template] of Object.entries(REFERENCE_TEMPLATES)) {
  const file = join(outDir, `${name}.jrxml`);
  writeFileSync(file, serializeJrxml(template), 'utf8');
  console.log(`emitido: ${file}`);
}
