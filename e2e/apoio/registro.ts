import { expect } from '@playwright/test';
import { REFERENCE_TEMPLATES, buildInputSchema, extractContract, serializeJrxml } from '@archbase/reportlenz-jrxml-core';
import { identidades, tokenDeApi } from './keycloak';

const API = process.env.DESIGNER_URL ?? 'http://localhost:8080';

/** Salva e publica um modelo do catálogo pela API (o que o time faria para uma dependência). */
export async function publicarPelaApi(chave: string): Promise<void> {
  const template = REFERENCE_TEMPLATES[chave]!;
  const token = await tokenDeApi(identidades().publicador);
  const cabecalhos = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const salvo = await fetch(`${API}/templates/${template.name}/versoes`, {
    method: 'POST',
    headers: cabecalhos,
    body: JSON.stringify({
      jrxml: serializeJrxml(template),
      inputSchema: buildInputSchema(extractContract(template), { templateName: template.name, version: 1 }),
    }),
  });
  expect(salvo.status).toBe(200);
  const { version } = (await salvo.json()) as { version: number };
  const publicado = await fetch(`${API}/templates/${template.name}/versoes/${version}/publicar`, { method: 'POST', headers: cabecalhos });
  expect(publicado.status).toBe(200);
}

