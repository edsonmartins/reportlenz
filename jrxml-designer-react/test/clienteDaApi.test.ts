import { afterEach, describe, expect, it, vi } from 'vitest';
import { criarClienteDaApi, urlDoServico } from '../src/api/cliente';

/** Cliente configurável (ADR-025 §2/§4, change componente-embutivel/2.2) — Scenario "Token da aplicação". */
describe('jrxml-designer-react · cliente da API', () => {
  afterEach(() => vi.unstubAllGlobals());

  const chamadas = () => {
    const f = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', f);
    return f;
  };
  const cabecalho = (f: ReturnType<typeof vi.fn>, i = 0) => new Headers((f.mock.calls[i]?.[1] as RequestInit).headers).get('Authorization');

  it('junta base e caminho sem barra dupla; sem base = mesma origem', () => {
    expect(urlDoServico('https://r.exemplo/', '/render/preview')).toBe('https://r.exemplo/render/preview');
    expect(urlDoServico('https://r.exemplo/api', 'render/preview')).toBe('https://r.exemplo/api/render/preview');
    expect(urlDoServico(undefined, '/render/preview')).toBe('/render/preview');
  });

  it('pede o token a CADA chamada (async) e envia Bearer — renovação é da aplicação', async () => {
    const f = chamadas();
    let n = 0;
    const api = criarClienteDaApi({ apiBaseUrl: 'https://r.exemplo', getAccessToken: () => Promise.resolve(`tok-${++n}`) });
    await api('/render/preview', { method: 'POST' });
    await api('/render/preview', { method: 'POST' });
    expect(f.mock.calls[0]?.[0]).toBe('https://r.exemplo/render/preview');
    expect(cabecalho(f, 0)).toBe('Bearer tok-1');
    expect(cabecalho(f, 1)).toBe('Bearer tok-2');
  });

  it('sem token (ou token vazio) não envia Authorization; preserva cabeçalhos do chamador', async () => {
    const f = chamadas();
    await criarClienteDaApi({ getAccessToken: () => null })('/x', { headers: { 'Content-Type': 'application/json' } });
    expect(cabecalho(f)).toBeNull();
    expect(new Headers((f.mock.calls[0]?.[1] as RequestInit).headers).get('Content-Type')).toBe('application/json');
  });

  it('401 aciona onNaoAutorizado e devolve a resposta ao chamador', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })));
    const aoNegar = vi.fn();
    const r = await criarClienteDaApi({ getAccessToken: () => 'velho', onNaoAutorizado: aoNegar })('/x');
    expect(r.status).toBe(401);
    expect(aoNegar).toHaveBeenCalledTimes(1);
  });

  it('nada vai para web storage', async () => {
    chamadas();
    await criarClienteDaApi({ getAccessToken: () => 'segredo' })('/x');
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });
});
