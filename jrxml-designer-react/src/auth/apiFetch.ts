/**
 * ÚNICO ponto de saída para o render-service (ADR-017 §6): injeta
 * `Authorization: Bearer <access_token>` quando há sessão e devolve a UI ao
 * estado "Entrar" num 401. Em modo dev (`oidc: null`) não há cabeçalho.
 */
import { useSessaoStore } from './authStore';

export async function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const { accessToken, sessaoExpirada } = useSessaoStore.getState();
  const headers = new Headers(init.headers);
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  const resposta = await fetch(url, { ...init, headers });
  if (resposta.status === 401) {
    sessaoExpirada();
  }
  return resposta;
}
