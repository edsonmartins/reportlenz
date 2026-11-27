import { removerIdentidades } from './apoio/keycloak';

export default async function globalTeardown(): Promise<void> {
  await removerIdentidades();
  console.log('[e2e] identidades temporárias removidas');
}
