import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { criarIdentidades } from './apoio/keycloak';

export default async function globalSetup(): Promise<void> {
  mkdirSync(join(import.meta.dirname, 'test-results'), { recursive: true });
  const id = await criarIdentidades();
  console.log(`[e2e] identidades temporárias criadas (sufixo ${id.sufixo})`);
}
