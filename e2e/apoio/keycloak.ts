/**
 * Admin REST do Keycloak para o E2E: cria usuários e um client de teste
 * TEMPORÁRIOS (sufixo único por execução) e os remove no teardown — os
 * usuários de homologação nunca são tocados.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const REALM = 'reportlenz';
const ARQUIVO = join(import.meta.dirname, '..', 'test-results', 'e2e-identidades.json');

export interface Identidades {
  sufixo: string;
  senha: string;
  designer: string;
  publicador: string;
  clienteApi: string;
  segredoApi: string;
}

function kc(): string {
  return process.env.KEYCLOAK_URL_PUBLICA ?? 'http://localhost:8180';
}

async function tokenAdmin(): Promise<string> {
  const usuario = process.env.KEYCLOAK_ADMIN_USER;
  const senha = process.env.KEYCLOAK_ADMIN_PASSWORD;
  if (!usuario || !senha) throw new Error('defina KEYCLOAK_ADMIN_USER e KEYCLOAK_ADMIN_PASSWORD (deploy/.env)');
  const r = await fetch(`${kc()}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    body: new URLSearchParams({ grant_type: 'password', client_id: 'admin-cli', username: usuario, password: senha }),
  });
  if (!r.ok) throw new Error(`token admin: HTTP ${r.status}`);
  return ((await r.json()) as { access_token: string }).access_token;
}

async function admin(token: string, metodo: string, caminho: string, corpo?: unknown): Promise<Response> {
  const r = await fetch(`${kc()}/admin/realms/${REALM}${caminho}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  if (!r.ok && r.status !== 404) throw new Error(`${metodo} ${caminho}: HTTP ${r.status} ${await r.text()}`);
  return r;
}

async function idDoUsuario(token: string, username: string): Promise<string | undefined> {
  const r = await admin(token, 'GET', `/users?exact=true&username=${encodeURIComponent(username)}`);
  return ((await r.json()) as Array<{ id: string }>)[0]?.id;
}

export async function criarIdentidades(): Promise<Identidades> {
  const token = await tokenAdmin();
  const sufixo = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const id: Identidades = {
    sufixo,
    senha: `E2e-${crypto.randomUUID()}`,
    designer: `e2e.designer.${sufixo}`,
    publicador: `e2e.publicador.${sufixo}`,
    clienteApi: `reportlenz-e2e-${sufixo}`,
    segredoApi: crypto.randomUUID(),
  };
  // Client confidencial só para o teste consultar a API (ROPC fica fora do client real).
  await admin(token, 'POST', '/clients', {
    clientId: id.clienteApi, publicClient: false, secret: id.segredoApi,
    directAccessGrantsEnabled: true, standardFlowEnabled: false,
  });
  const papeis = (await (await admin(token, 'GET', '/roles')).json()) as Array<{ id: string; name: string }>;
  const papel = (nome: string) => {
    const p = papeis.find((x) => x.name === nome);
    if (!p) throw new Error(`papel ${nome} ausente no realm`);
    return p;
  };
  for (const [username, nomes] of [
    [id.designer, ['reportlenz-designer']],
    [id.publicador, ['reportlenz-designer', 'reportlenz-publicador']],
  ] as const) {
    await admin(token, 'POST', '/users', {
      username, enabled: true, emailVerified: true, email: `${username}@reportlenz.invalid`,
      firstName: 'E2E', lastName: 'Teste', requiredActions: [],
      credentials: [{ type: 'password', value: id.senha, temporary: false }],
    });
    const uid = await idDoUsuario(token, username);
    await admin(token, 'POST', `/users/${uid}/role-mappings/realm`, nomes.map(papel));
  }
  writeFileSync(ARQUIVO, JSON.stringify(id));
  return id;
}

export function identidades(): Identidades {
  return JSON.parse(readFileSync(ARQUIVO, 'utf8')) as Identidades;
}

export async function removerIdentidades(): Promise<void> {
  let id: Identidades;
  try {
    id = identidades();
  } catch {
    return;
  }
  const token = await tokenAdmin();
  for (const username of [id.designer, id.publicador]) {
    const uid = await idDoUsuario(token, username);
    if (uid) await admin(token, 'DELETE', `/users/${uid}`);
  }
  const clientes = (await (await admin(token, 'GET', `/clients?clientId=${id.clienteApi}`)).json()) as Array<{ id: string }>;
  for (const c of clientes) await admin(token, 'DELETE', `/clients/${c.id}`);
}

/** Token de API (ROPC pelo client temporário) — só para verificações do teste. */
export async function tokenDeApi(username: string): Promise<string> {
  const id = identidades();
  const r = await fetch(`${kc()}/realms/${REALM}/protocol/openid-connect/token`, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'password', client_id: id.clienteApi, client_secret: id.segredoApi,
      username, password: id.senha, scope: 'openid',
    }),
  });
  if (!r.ok) throw new Error(`token de ${username}: HTTP ${r.status}`);
  return ((await r.json()) as { access_token: string }).access_token;
}
