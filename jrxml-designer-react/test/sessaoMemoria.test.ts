import { User } from 'oidc-client-ts';
import { describe, expect, it } from 'vitest';
import { criarGerente } from '../src/auth/authStore';

/**
 * ADR-017 §6 / RFC-004: com a biblioteca REAL, o usuário (tokens) e o estado
 * do OIDC ficam só em memória — nada em localStorage/sessionStorage.
 */
describe('jrxml-designer-react · sessão OIDC só em memória', () => {
  it('storeUser/getUser funcionam sem tocar web storage', async () => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    const gerente = criarGerente({ authority: 'https://sso.exemplo/realms/reportlenz', clientId: 'reportlenz' });
    const usuario = new User({
      access_token: 'tok',
      token_type: 'Bearer',
      profile: { sub: 's1', iss: 'https://sso.exemplo/realms/reportlenz', aud: 'reportlenz', exp: 0, iat: 0 },
      expires_at: Math.floor(Date.now() / 1000) + 300,
    });
    await gerente.storeUser(usuario);
    expect((await gerente.getUser())?.access_token).toBe('tok');
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });
});
