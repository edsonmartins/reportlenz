/**
 * Sessão do usuário (ADR-017 §6): OIDC Authorization Code + PKCE por POPUP no
 * Keycloak, com usuário e estado SÓ em memória (RFC-004: sem localStorage/
 * sessionStorage). Recarregar a página tenta `signinSilent` (sessão SSO do
 * Keycloak) antes de pedir login.
 *
 * `/config.json` (gerado no deploy) decide o modo:
 * - `{ "oidc": null }` → modo dev, sem login (casa com REPORTLENZ_SEGURANCA_HABILITADA=false);
 * - `{ "oidc": { "authority", "clientId" } }` → login obrigatório.
 */
import { InMemoryWebStorage, UserManager, WebStorageStateStore, type User } from 'oidc-client-ts';
import { create } from 'zustand';

export interface ConfiguracaoOidc {
  authority: string;
  clientId: string;
}

export type ModoDeSessao = 'carregando' | 'dev' | 'anonimo' | 'autenticado';

interface EstadoDeSessao {
  modo: ModoDeSessao;
  usuario: string | null;
  accessToken: string | null;
  erro: string | null;
  iniciar: () => Promise<void>;
  entrar: () => Promise<void>;
  sair: () => Promise<void>;
  /** Chamado pelo apiFetch num 401: o token não vale mais. */
  sessaoExpirada: () => void;
}

let gerente: UserManager | null = null;

/** Exportado p/ teste: as settings são o contrato "sem browser storage". */
export function criarGerente(config: ConfiguracaoOidc): UserManager {
  const memoria = new WebStorageStateStore({ store: new InMemoryWebStorage() });
  const retorno = `${window.location.origin}/oidc-callback.html`;
  return new UserManager({
    authority: config.authority,
    client_id: config.clientId,
    redirect_uri: retorno,
    popup_redirect_uri: retorno,
    silent_redirect_uri: retorno,
    post_logout_redirect_uri: window.location.origin,
    response_type: 'code',
    scope: 'openid profile',
    automaticSilentRenew: true,
    userStore: memoria,
    stateStore: memoria,
  });
}

function nomeDe(user: User): string {
  const p = user.profile;
  return p.preferred_username ?? p.name ?? p.sub;
}

async function lerConfiguracao(): Promise<ConfiguracaoOidc | null> {
  const resposta = await fetch('/config.json', { cache: 'no-store' });
  if (!resposta.ok) {
    throw new Error(`/config.json respondeu HTTP ${resposta.status}`);
  }
  const corpo = (await resposta.json()) as { oidc?: ConfiguracaoOidc | null };
  return corpo.oidc ?? null;
}

export const useSessaoStore = create<EstadoDeSessao>((set, get) => {
  const aplicar = (user: User | null) => {
    if (user && !user.expired) {
      set({ modo: 'autenticado', usuario: nomeDe(user), accessToken: user.access_token, erro: null });
    } else {
      set({ modo: 'anonimo', usuario: null, accessToken: null });
    }
  };

  return {
    modo: 'carregando',
    usuario: null,
    accessToken: null,
    erro: null,

    iniciar: async () => {
      try {
        const config = await lerConfiguracao();
        if (!config) {
          set({ modo: 'dev', usuario: null, accessToken: null, erro: null });
          return;
        }
        gerente = criarGerente(config);
        gerente.events.addUserLoaded(aplicar);
        gerente.events.addUserUnloaded(() => aplicar(null));
        gerente.events.addSilentRenewError(() => get().sessaoExpirada());
        try {
          aplicar(await gerente.signinSilent());
        } catch {
          // login_required / sem sessão SSO: o usuário entra pelo botão.
          aplicar(null);
        }
      } catch (e) {
        set({ modo: 'anonimo', erro: e instanceof Error ? e.message : String(e) });
      }
    },

    entrar: async () => {
      if (!gerente) return;
      try {
        set({ erro: null });
        aplicar(await gerente.signinPopup());
      } catch (e) {
        set({ erro: e instanceof Error ? e.message : String(e) });
      }
    },

    sair: async () => {
      const atual = gerente;
      aplicar(null);
      if (atual) {
        await atual.removeUser();
        await atual.signoutRedirect().catch(() => undefined);
      }
    },

    sessaoExpirada: () => {
      if (get().modo === 'autenticado') {
        set({ modo: 'anonimo', usuario: null, accessToken: null, erro: 'Sessão expirada — entre novamente.' });
      }
    },
  };
});
