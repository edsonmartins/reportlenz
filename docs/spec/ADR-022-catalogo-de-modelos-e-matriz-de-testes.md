# ADR-022 — Catálogo ampliado de modelos de referência e matriz de testes por cenário

- **Status:** Accepted (pedido do usuário em 2026-11-27)
- **Data:** 2026-11-27
- **Relacionado:** RFC-001 §7 (conjunto de referência), ADR-003 (contract-first/Push), ADR-013 (G1 no harness),
  ADR-015 (grade multi-registro), ADR-016 (G7), ADR-020 (subreport por codename), ADR-019 (homologação)
- **Implementa:** `openspec/changes/variacoes-de-templates`

## Contexto

A galeria tinha 5 modelos: em branco, fatura (com o filho `fatura_entregas`), comprovante, formulário e
etiqueta A4. Os testes de render tinham **um** payload escrito à mão por modelo. Eles não exercitavam:

- volume (muitas páginas);
- payload mínimo ou com nulos;
- textos longos;
- leitura dos códigos de barras.

O usuário pediu mais variações de modelo nas quatro famílias propostas: fiscais/cobrança, gerenciais,
etiquetas/crachás e cartas/documentos. Pediu também cobertura em todas as camadas: core, engine, E2E e
regressão visual. Pediu ainda uma pesquisa de **DANFE** e **boleto**.

### Pesquisa: DANFE e boleto

- **DANFE.** O leiaute é definido pelo Manual de Especificações Técnicas do DANFE (MOC, Anexo II) e
  pelo Ajuste SINIEF 07/05. Suas regras básicas:
  - **Blocos:** canhoto; identificação do emitente; quadro "DANFE" (entrada/saída, número, série,
    folha); código de barras da chave; natureza da operação e protocolo; destinatário/remetente;
    cálculo do imposto; transportador; dados dos produtos; dados adicionais.
  - **Código de barras:** CODE-128C com **apenas a chave de acesso de 44 dígitos**.
  - **Chave impressa:** em 11 blocos de 4 dígitos.
  - **Páginas seguintes:** a identificação do emitente se repete.
  
  Não achamos JRXML de DANFE com licença compatível. **Nenhum JRXML de terceiros é copiado**: o modelo é
  desenhado a partir da especificação pública.
- **Boleto (ficha de compensação).** O padrão vem da FEBRABAN e das Circulares BCB 2.531/2.926:
  - código de barras **Interleaved 2 of 5** com **44 posições**: banco (3), moeda (1), DV geral (1, módulo
    11), fator de vencimento (4), valor (10) e campo livre (25);
  - linha digitável de 47 posições em 5 campos;
  - recibo do pagador destacável acima da ficha.

Nos dois casos, o **cálculo** (DV, fator de vencimento, campo livre, chave de acesso) é regra de negócio
do backend de domínio. Pelo contrato Push (ADR-003), o template **recebe** `codigo_barras`,
`linha_digitavel` e `chave_acesso` prontos e só os desenha. O ReportLenz não vira emissor fiscal nem
bancário.

## Decisão

### 1. Catálogo de modelos

O catálogo de referência do `jrxml-core` ganha 10 modelos, todos dentro do modelo já suportado. Isso não
exige nenhuma extensão do JRXML nem do G7.

| Família | Chave | O que exercita |
|---|---|---|
| Fiscais/cobrança | `boleto` | I2of5 44 pos., ficha de compensação + recibo do pagador, linha tracejada de corte |
| | `danfe` | CODE-128C da chave, canhoto no título, emitente no `pageHeader` (repete por folha), tabela de produtos que atravessa páginas |
| | `orcamento` | Expressão BigDecimal (qtd × preço), totais vindos do payload, condições elásticas |
| Gerenciais | `listagem_vendas` | A4 **paisagem**, mestre = coleção (ADR-015), grupo por vendedor com subtotal, total geral, zebra condicional, cabeçalho de coluna repetido |
| | `extrato_conta` | Mestre = lançamentos, saldo acumulado (`saldo_anterior` + soma corrente), negativos em vermelho |
| Etiquetas/crachás | `etiqueta_produto_qr` | Grade 4 colunas com QR e SKU |
| | `etiqueta_enderecamento` | Grade 2 colunas, remetente/destinatário, CODE-128 de rastreio |
| | `cracha` | Grade 2 colunas com foto (imagem `onErrorType=Blank`), faixa colorida, QR de identificação |
| Cartas/documentos | `carta_declaracao` | Texto longo elástico, assinatura no `summary` (flui após o corpo) |
| | `contrato` | Multipágina: mestre = cláusulas, `pageHeader`/`pageFooter` em todas as folhas, assinaturas no `summary` |

### 2. Cenários de teste

Os cenários passam a ser **dados**, não código de teste. O módulo `reference/cenarios.ts` declara, por
modelo, uma lista de cenários `{ nome, payload, espera }`:

- `tipico`;
- `minimo`: apenas o essencial, com nulos e coleções vazias;
- `volume`: centenas de linhas, quando houver coleção;
- `textos_longos`.

`espera` declara:

- os textos que devem aparecer, e os que não devem;
- a faixa de páginas;
- os **códigos de barras que devem ser lidos** no PNG.

O `emit:fixtures` emite `<chave>.cenarios.json` ao lado do `.jrxml`/`.schema.json`.

### 3. Matriz de testes

Cada modelo passa por todas as camadas sem teste escrito à mão:

1. **Core.** Para cada modelo:
   - round-trip idempotente;
   - validação dupla;
   - **G1–G6 verdes** (`avaliarGates`);
   - cada cenário satisfaz o `inputSchema` gerado.
2. **Engine (render-service).** Para cada modelo e cenário:
   - payload validado pelo `ValidadorDePayload` (networknt);
   - compile com **G7**;
   - **G8**, com o registro feito dos próprios fixtures;
   - fill com o **filtro de classes** (ADR-021);
   - PDF lido com PDFBox (textos e páginas);
   - PNG decodificado com **ZXing** (test scope). O conteúdo de cada barcode é comparado com o esperado:
     prova que o I2of5 do boleto e o CODE-128C do DANFE são **legíveis**, não apenas desenhados.
3. **Harness (G1).** Já varre o diretório de fixtures, então cobre os novos modelos automaticamente.
4. **E2E (Playwright).** Para cada modelo da galeria:
   - abre o modelo;
   - renderiza o preview sem erro;
   - o publicador publica.
   
   A exceção é a `fatura`, que depende do filho e já é coberta pelo cenário G8.
5. **Regressão visual.** O PNG do preview vem do engine no contêiner Linux, então é o mesmo localmente e
   no CI. Ele é comparado com uma imagem de referência versionada (`toMatchSnapshot`, tolerância pequena,
   caminho **sem** sufixo de plataforma). Atualização é explícita: `pnpm --dir e2e test
   --update-snapshots`, revisada no PR.

## Alternativas consideradas

- **Escrever um teste por modelo e camada.** Com 15 modelos e 4 camadas, a manutenção cresce de forma
  linear e é fácil esquecer uma camada. Rejeitada: a matriz deriva tudo do catálogo.
- **Calcular DV, fator de vencimento e chave dentro do template.** Isso exigiria lógica bancária e fiscal
  em expressão: viola o contract-first e o vocabulário do G7. Rejeitada.
- **Copiar um JRXML de DANFE ou boleto da internet.** Haveria risco de licença, e o resultado seria
  dialeto 6.x, que o G4 recusa. Rejeitada.
- **Regressão visual por screenshot da tela inteira.** Ela depende da fonte do sistema operacional e do
  navegador. Rejeitada em favor do PNG do engine, que é determinístico.

## Consequências

- A galeria passa de 5 para 15 entradas: 14 modelos, mais o em branco.
- **Todo modelo novo entra automaticamente em todas as camadas** ao ser registrado em `REFERENCE_TEMPLATES`
  com cenários.
- Imagens de referência versionadas no repositório: uma por modelo da galeria, poucos KB cada.
- Mudança de layout intencional exige atualizar a imagem de referência no mesmo PR.
- Fora de escopo:
  - validação fiscal ou bancária dos valores recebidos;
  - DANFE em paisagem, NFC-e e DANFE simplificado;
  - térmica (ADR-011).
