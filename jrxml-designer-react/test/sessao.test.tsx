import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Change autenticacao-keycloak/3.2 (ADR-017 §6) — cenários do spec
 * `autenticacao`: modo dev sem login, usuário não autenticado vê "Entrar" e a
 * API não é chamada, chamadas autenticadas levam Bearer, 401 volta a "Entrar".
 * O UserManager do oidc-client-ts é simulado (sem Keycloak no jsdom).
 */
const silent = vi.fn();
const popup = vi.fn();
const signout = vi.fn();
const remover = vi.fn();

vi.mock('oidc-client-ts', () => ({
  UserManager: class {
    events = { addUserLoaded: vi.fn(), addUserUnloaded: vi.fn(), addSilentRenewError: vi.fn() };
    signinSilent = silent;
    signinPopup = popup;
    removeUser = remover;
    signoutRedirect = signout;
  },
  InMemoryWebStorage: class {},
  WebStorageStateStore: class {},
}));

const { useSessaoStore } = await import('../src/auth/authStore');
const { PortaoDeSessao, UsuarioDaSessao } = await import('../src/auth/PortaoDeSessao');
const { apiFetch } = await import('../src/auth/apiFetch');

const OIDC = { oidc: { authority: 'https://sso.exemplo/realms/reportlenz', clientId: 'reportlenz' } };
const USUARIO = { access_token: 'tok-ana', expired: false, profile: { sub: 's1', preferred_username: 'ana' } };

function resposta(status: number, corpo: unknown = {}) {
  return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(corpo) } as Response;
}

function montar() {
  return render(
    <MantineProvider>
      <PortaoDeSessao>
        <div data-testid="designer">designer</div>
        <UsuarioDaSessao />
      </PortaoDeSessao>
    </MantineProvider>,
  );
}

describe('jrxml-designer-react · sessão OIDC (ADR-017)', () => {
  beforeEach(() => {
    useSessaoStore.setState({ modo: 'carregando', usuario: null, accessToken: null, erro: null });
    silent.mockReset();
    popup.mockReset();
    signout.mockReset().mockResolvedValue(undefined);
    remover.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('modo dev (oidc: null): designer sem login e chamadas SEM Authorization', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(url === '/config.json' ? resposta(200, { oidc: null }) : resposta(200)));
    vi.stubGlobal('fetch', fetchMock);
    montar();
    await waitFor(() => expect(screen.getByTestId('designer')).toBeInTheDocument());

    await apiFetch('/render/preview', { method: 'POST' });
    const headers = (fetchMock.mock.calls[1]?.[1] as RequestInit).headers as Headers;
    expect(headers.has('Authorization')).toBe(false);
  });

  it('sem sessão SSO: mostra "Entrar", não monta o designer e não chama a API', async () => {
    silent.mockRejectedValue(new Error('login_required'));
    const fetchMock = vi.fn().mockResolvedValue(resposta(200, OIDC));
    vi.stubGlobal('fetch', fetchMock);
    montar();

    await waitFor(() => expect(screen.getByTestId('sessao-entrar')).toBeInTheDocument());
    expect(screen.queryByTestId('designer')).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.map((c) => c[0] as string)).toEqual(['/config.json']);
  });

  it('login por popup → designer + usuário; chamadas com Bearer; nada em web storage', async () => {
    silent.mockRejectedValue(new Error('login_required'));
    popup.mockResolvedValue(USUARIO);
    const fetchMock = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(url === '/config.json' ? resposta(200, OIDC) : resposta(200)));
    vi.stubGlobal('fetch', fetchMock);
    montar();

    fireEvent.click(await screen.findByTestId('sessao-entrar'));
    await waitFor(() => expect(screen.getByTestId('designer')).toBeInTheDocument());
    expect(screen.getByTestId('sessao-usuario')).toHaveTextContent('ana');

    await apiFetch('/render/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    const headers = (fetchMock.mock.calls.at(-1)?.[1] as RequestInit).headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer tok-ana');
    expect(headers.get('Content-Type')).toBe('application/json');
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it('sessão SSO existente: signinSilent entra sem clique', async () => {
    silent.mockResolvedValue(USUARIO);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta(200, OIDC)));
    montar();
    await waitFor(() => expect(screen.getByTestId('designer')).toBeInTheDocument());
    expect(popup).not.toHaveBeenCalled();
  });

  it('401 da API devolve a UI ao estado "Entrar"', async () => {
    silent.mockResolvedValue(USUARIO);
    const fetchMock = vi.fn().mockImplementation((url: string) =>
      Promise.resolve(url === '/config.json' ? resposta(200, OIDC) : resposta(401)));
    vi.stubGlobal('fetch', fetchMock);
    montar();
    await waitFor(() => expect(screen.getByTestId('designer')).toBeInTheDocument());

    await apiFetch('/render/preview', { method: 'POST' });
    await waitFor(() => expect(screen.getByTestId('sessao-entrar')).toBeInTheDocument());
    expect(screen.getByTestId('sessao-erro')).toHaveTextContent('Sessão expirada');
  });

  it('Sair redireciona ao logout do Keycloak COM o usuário em memória (id_token_hint, sem tela de confirmação)', async () => {
    silent.mockResolvedValue(USUARIO);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta(200, OIDC)));
    montar();
    await waitFor(() => expect(screen.getByTestId('designer')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));
    await waitFor(() => expect(signout).toHaveBeenCalledTimes(1));
    // O usuário NÃO foi removido antes do redirect (senão o hint não vai).
    expect(remover).not.toHaveBeenCalled();
  });

  it('Sair com falha no redirect limpa a sessão local e volta a "Entrar"', async () => {
    silent.mockResolvedValue(USUARIO);
    signout.mockRejectedValue(new Error('rede fora'));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta(200, OIDC)));
    montar();
    await waitFor(() => expect(screen.getByTestId('designer')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Sair' }));
    await waitFor(() => expect(screen.getByTestId('sessao-entrar')).toBeInTheDocument());
    expect(remover).toHaveBeenCalledTimes(1);
  });
});
