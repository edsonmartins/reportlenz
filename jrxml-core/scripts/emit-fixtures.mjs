/**
 * Emite os templates de referência como .jrxml para o harness Java (phase-0/5.2)
 * e os records Java gerados do contrato (phase-1/3.3 — compilados com javac no
 * CI, prova do critério "record(s) Java compiláveis" da RFC-002 §7).
 * Requer `pnpm build` antes (importa de dist/).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REFERENCE_TEMPLATES, buildInputSchema, extractContract, genJavaRecord, serializeJrxml } from '../dist/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, '../../tools/jr7-harness/fixtures');
const outDirJava = resolve(here, '../../tools/jr7-harness/fixtures-java');
mkdirSync(outDir, { recursive: true });
mkdirSync(outDirJava, { recursive: true });

const pascal = (s) => s.split(/[^A-Za-z0-9]+/).filter(Boolean).map((p) => p[0].toUpperCase() + p.slice(1)).join('');

for (const [name, template] of Object.entries(REFERENCE_TEMPLATES)) {
  const file = join(outDir, `${name}.jrxml`);
  writeFileSync(file, serializeJrxml(template), 'utf8');
  console.log(`emitido: ${file}`);

  const schema = buildInputSchema(extractContract(template), { templateName: name, version: 1 });
  const rootName = `${pascal(name)}Payload`;
  const java = genJavaRecord(schema, { rootName, packageName: 'dev.reportlenz.contrato' });
  const fileJava = join(outDirJava, `${rootName}.java`);
  writeFileSync(fileJava, java, 'utf8');
  console.log(`emitido: ${fileJava}`);

  // inputSchema gerado pelo core — consumido pelo teste cruzado do render-service
  // (prova RFC-002 §7: o schema TS é validável pelo networknt do serviço).
  const fileSchema = join(outDir, `${name}.schema.json`);
  writeFileSync(fileSchema, JSON.stringify(schema, null, 2), 'utf8');
  console.log(`emitido: ${fileSchema}`);
}
