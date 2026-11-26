# Change: subreport-por-codename

## Why
O ADR-016 recusou subreport por localização (desserialização de arquivo apontado pelo payload) e deixou a
resolução por template publicado para depois. Sem ela, o elemento subreport do designer não tem caminho
funcional. Decisão em ADR-020.

## What Changes
- Subreport referencia template publicado por literal `"repo:<codename>[@versão]"`; outra expressão → G7.
- Fill resolve `repo:` pelo registro, compilando com cache + G7.
- Gate **G8** no publish: referências resolvíveis e sem ciclo; preview com referência quebrada → 400.
- jrxml-core: `SUBREPORT_REF_INVALID` no design-time; referências "Fatura" + nova `fatura_entregas`.
- Designer: paleta e painel com a nova sintaxe; Publish Wizard envia o codename (detecção de ciclo).

## Impact
- Affected specs: `subreport` (nova capability); G7 (ADR-016) ampliado.
- Affected code: `jrxml-core` (validate, errors, reference), `jrxml-designer-react` (palette, props,
  publish), `render-service` (VerificadorDeExpressoes, ContextoJasperRestrito, ResolvedorDeSubreports,
  VerificadorDeGates, controllers), testes e fixtures do harness.
- Depende de: `seguranca-expressoes`.
