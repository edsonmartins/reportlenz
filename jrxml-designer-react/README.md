# @reportlenz/designer-react

Designer e preview de relatórios **JRXML 7 contract-first** como componentes React. O render é real,
feito pelo engine JasperReports no ReportLenz render-service. Os dados chegam por **Push**: o relatório
declara os campos que espera e nunca leva SQL embutido.

## Requisitos

- React 19 e **Mantine 9**, com `MantineProvider` e o CSS do `@mantine/core` na aplicação. Os dois são
  peerDependencies, e o componente usa o tema da aplicação.
- Um **ReportLenz render-service** acessível.
  - Mesma origem, via proxy: nada a configurar.
  - Outra origem: liste a origem da aplicação em `REPORTLENZ_CORS_ORIGENS` no serviço.
- Um token de acesso (Keycloak/OIDC) com os papéis do ReportLenz: `reportlenz-designer` para editar e
  pré-visualizar, `reportlenz-publicador` para publicar.

```bash
npm install @reportlenz/designer-react @reportlenz/jrxml-core
# peers: react react-dom @mantine/core @mantine/hooks
```

## `<ReportLenzDesigner>`

O componente ocupa 100% do contêiner, então defina a altura no elemento pai. Cada instância é
independente.

### Modo registro (padrão)

Abre, salva e publica templates no registro do serviço, com versões e os gates G1–G8:

```tsx
import '@mantine/core/styles.css';
import { MantineProvider } from '@mantine/core';
import { ReportLenzDesigner } from '@reportlenz/designer-react';

<MantineProvider>
  <div style={{ height: '80vh' }}>
    <ReportLenzDesigner
      apiBaseUrl="https://relatorios.empresa.com.br"
      getAccessToken={() => auth.token()}          // pedido a cada chamada; nunca guardado
      onNaoAutorizado={() => auth.renovar()}
      codename="danfe_retrato"                      // ausente = galeria de modelos
      onSalvo={({ codename, versao }) => console.log('salvo', codename, versao)}
      onPublicado={({ versao, pacoteDeIntegracao }) => console.log('publicado', versao, pacoteDeIntegracao)}
    />
  </div>
</MantineProvider>
```

### Modo controlado

A aplicação guarda o template e decide onde persistir:

```tsx
const [jrxml, setJrxml] = useState(jrxmlInicial);

<ReportLenzDesigner
  apiBaseUrl="https://relatorios.empresa.com.br"
  getAccessToken={() => auth.token()}
  template={jrxml}                                   // JRXML 7 ou modelo do @reportlenz/jrxml-core
  onChange={(modelo, novoJrxml) => setJrxml(novoJrxml)}
/>
```

### Recursos

`recursos` liga e desliga partes da interface: `galeria`, `assistente`, `salvar` e `publicar`. Os
valores padrão dependem do modo:

| Recurso | Modo registro | Modo controlado |
|---|---|---|
| `galeria` | ligado se não houver `codename` | desligado |
| `assistente` | ligado | ligado |
| `salvar` | ligado | desligado |
| `publicar` | ligado | desligado |

`acoesExtras` coloca conteúdo da aplicação na barra do designer.

## `<ReportLenzPreview>`

Mostra o render de um template **publicado** com os dados da aplicação, só leitura, com zoom e paginação:

```tsx
import { ReportLenzPreview } from '@reportlenz/designer-react';

<ReportLenzPreview
  apiBaseUrl="https://relatorios.empresa.com.br"
  getAccessToken={() => auth.token()}
  codename="danfe_retrato"                           // sem `versao` = a publicada mais recente
  payload={nota}                                     // validado pelo serviço contra o contrato (422)
/>
```

## Segurança

- O componente não faz login: o token vem de `getAccessToken`.
- Nada é gravado em `localStorage` nem em `sessionStorage`.
- A autorização é sempre do serviço. Papéis insuficientes aparecem como 403 na interface.

## Licença

MIT. O engine JasperReports (LGPLv3) roda só no render-service e **não** faz parte deste pacote.
