/**
 * Cliente do render-service injetado na instância do designer (ADR-025):
 * toda chamada do componente passa por aqui — nunca por `fetch` direto.
 */
import { apiFetch } from '../auth/apiFetch';

/** Mesma assinatura do `fetch`, com caminho relativo ao render-service (ex.: `/render/preview`). */
export type ClienteDaApi = (caminho: string, init?: RequestInit) => Promise<Response>;

/** Cliente da SPA de homologação: sessão OIDC própria (ADR-017 §6). */
export const clientePadrao: ClienteDaApi = (caminho, init) => apiFetch(caminho, init);
