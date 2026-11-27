# ADR-025 — Designer e preview como componentes React publicados no npm

- **Status:** Accepted (pedido do usuário em 2026-11-27)
- **Data:** 2026-11-27
- **Relacionado:** ADR-005 (React + Mantine), ADR-017 (Keycloak/papéis), ADR-024 (abas), ADR-006 (fronteira
  LGPL), RFC-004
- **Implementa:** `openspec/changes/componente-embutivel`

## Contexto

O designer é uma SPA isolada. O objetivo agora é **embutir o editor e o preview nas aplicações web React
da empresa**, que usam Mantine/Archbase. O que impede isso hoje:

1. **Estado global:** 4 stores zustand globais (documento, canvas, preview, sessão). Duas instâncias na
   mesma página compartilhariam o documento.
2. **Login próprio:** a SPA faz o OIDC (popup PKCE) e lê `/config.json`. Embutida, quem autentica é a
   aplicação hospedeira.
3. **Endereço fixo:** as chamadas vão para caminhos relativos (`/render/preview`), sem endereço
   configurável.
4. **Pacotes privados:** o `jrxml-core` e o designer são `private` e nunca foram publicados.

> **Emenda (2026-11-27, decisão do usuário):**
> - Os pacotes são publicados no escopo **`@archbase`**, já usado pelos pacotes do Archbase:
>   `@archbase/reportlenz-jrxml-core` e `@archbase/reportlenz-designer-react`.
> - O processo de release segue o do archbase-react e do linktor-webchat-sdk: `NPM_TOKEN`, diagnóstico
>   de autenticação e `pnpm publish -r`, sem provenance.
> - Onde este ADR diz `@reportlenz/…`, leia `@archbase/reportlenz-…`.

## Decisão

Decisões do usuário em 2026-11-27:

- publicar no **npmjs.com público**;
- as aplicações hospedeiras usam **Mantine/Archbase**;
- **a aplicação fornece o token**;
- persistência nos **dois modos**.

### 1. Pacotes

- **`@reportlenz/jrxml-core`:** publicado como está (ESM + `.d.ts`), licença MIT.
- **`@reportlenz/designer-react`:** biblioteca ESM + `.d.ts` + CSS próprio.
  - `react`, `react-dom`, `@mantine/core` e `@mantine/hooks` são **peerDependencies**: o componente usa o
    `MantineProvider` e o tema da aplicação, sem duplicar biblioteca nem CSS.
  - O Archbase sai das dependências; está declarado, mas não é importado em lugar nenhum.
- O `jrxml-designer-react` continua sendo também a **SPA de homologação**, mas passa a ser
  **consumidora da API pública** do componente (dogfooding).
  - OIDC, `/config.json` e `PortaoDeSessao` ficam só no app e não entram no pacote.
  - O E2E da SPA passa, portanto, a testar o componente.

### 2. API pública

```tsx
<ReportLenzDesigner
  apiBaseUrl="https://relatorios.empresa.com.br"   // default: mesma origem
  getAccessToken={() => auth.token()}               // Bearer em toda chamada; sem login próprio
  // modo REGISTRO (default): abre/salva/publica pelo render-service
  codename="danfe_retrato" versao={3}               // ausente → galeria
  onSalvo={(v) => …} onPublicado={(v) => …}
  // modo CONTROLADO: a aplicação guarda o template
  template={jrxmlOuModelo} onChange={(t, jrxml) => …}
  recursos={{ galeria: true, assistente: true, publicar: true }}
/>

<ReportLenzPreview apiBaseUrl=… getAccessToken=… codename="danfe_retrato" payload={dados} />
```

- O componente ocupa **100% do contêiner** (a aplicação define a altura).
- O modo é inferido das props: com `template` + `onChange`, é controlado; senão, é registro. As duas
  combinações juntas são erro explícito em desenvolvimento.
- `ReportLenzPreview` renderiza um template **publicado** com dados reais, só leitura. É o mesmo endpoint
  e o mesmo papel exigidos pela API.

### 3. Estado por instância

- Os stores viram **fábricas**: `criarInstanciaDoDesigner({ api })` monta documento, canvas, preview e
  cliente de API já ligados entre si.
- A instância é entregue por **contexto React**. Cada `<ReportLenzDesigner>` cria a sua, então duas na
  mesma página são independentes.
- Fora de um provider vale uma **instância padrão**. A SPA e os testes de componente continuam
  funcionando sem reescrita.

### 4. Segurança

- O componente **nunca persiste o token**: pede `getAccessToken()` a cada chamada e não usa web storage
  (RFC-004).
- A autorização continua **no serviço** (papéis do ADR-017). O componente só reflete 401/403.
- `apiBaseUrl` de outra origem exige CORS no render-service. Isso é configuração do deploy, documentada;
  o default continua sendo a mesma origem (proxy da aplicação).

### 5. Publicação

- Versionamento semântico, começando em `0.x`.
- Workflow de release por tag `v*`: build, testes e `npm publish --provenance` dos dois pacotes.
- A **publicação real** depende do usuário: criar a organização `@reportlenz` no npm e o segredo
  `NPM_TOKEN` no GitHub. Antes disso, o CI valida com `npm pack` e com uma **aplicação hospedeira de
  teste** que instala os tarballs.

## Alternativas consideradas

- **iframe da SPA.** Isola tudo, mas tema, tamanho, eventos e token cruzam por `postMessage`, e cada
  aplicação vira um segundo app. Rejeitada: o pedido é componente.
- **Web Component (custom element).** Neutro de framework, mas as aplicações são React/Mantine, e o
  Shadow DOM brigaria com o tema e os portais do Mantine. Rejeitada por ora.
- **Mantine embutido no pacote.** Duplicaria a biblioteca e conflitaria com o `MantineProvider` da
  aplicação. Desnecessário, já que as aplicações usam Mantine.

## Consequências

- A API pública vira contrato. Mudança incompatível exige versão major (após 1.0) e changelog.
- Fronteira de licença (ADR-006): os pacotes npm são código próprio (MIT). A JasperReports continua só no
  render-service, sem distribuição.
- O render-service precisa de CORS configurável para `apiBaseUrl` de outra origem. Isso entra neste
  change, com a lista de origens permitidas vazia por default.
