/**
 * Cliente do render-service injetado na instância do designer (ADR-025):
 * toda chamada do componente passa por aqui — nunca por `fetch` direto.
 */
import { apiFetch } from '../auth/apiFetch';

/** Mesma assinatura do `fetch`, com caminho relativo ao render-service (ex.: `/render/preview`). */
export type ClienteDaApi = (caminho: string, init?: RequestInit) => Promise<Response>;

/** Token fornecido pela aplicação hospedeira (síncrono ou assíncrono; vazio = sem cabeçalho). */
export type ObterToken = () => string | null | undefined | Promise<string | null | undefined>;

export interface OpcoesDoCliente {
  /** Base do render-service (ex.: `https://relatorios.empresa.com.br`). Default: mesma origem. */
  apiBaseUrl?: string;
  /**
   * Chamado a CADA requisição (ADR-025 §4): o componente nunca guarda o token
   * — a aplicação o renova como quiser (refresh do Keycloak, MSAL…).
   */
  getAccessToken?: ObterToken;
  /** 401 do serviço: a aplicação decide (renovar sessão, redirecionar ao login…). */
  onNaoAutorizado?: () => void;
}

/** Junta base e caminho sem barra dupla nem perdida. */
export function urlDoServico(apiBaseUrl: string | undefined, caminho: string): string {
  if (!apiBaseUrl) return caminho;
  return `${apiBaseUrl.replace(/\/+$/, '')}/${caminho.replace(/^\/+/, '')}`;
}

export function criarClienteDaApi(opcoes: OpcoesDoCliente = {}): ClienteDaApi {
  return async (caminho, init = {}) => {
    const headers = new Headers(init.headers);
    const token = await opcoes.getAccessToken?.();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const resposta = await fetch(urlDoServico(opcoes.apiBaseUrl, caminho), { ...init, headers });
    if (resposta.status === 401) opcoes.onNaoAutorizado?.();
    return resposta;
  };
}

/** Cliente da SPA de homologação: sessão OIDC própria (ADR-017 §6). */
export const clientePadrao: ClienteDaApi = (caminho, init) => apiFetch(caminho, init);
