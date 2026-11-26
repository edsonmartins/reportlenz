# Tasks — subreport-por-codename

- [x] 1.1 ADR-020 + pacote OpenSpec (proposal/spec/tasks)
- [x] 2.1 jrxml-core: SUBREPORT_REF_INVALID + helper de referência; Fatura → "repo:fatura_entregas"; nova
      referência fatura_entregas; testes; fixtures do harness
- [x] 2.2 Designer: paleta/painel com a sintaxe repo:; Publish Wizard envia codename; testes
- [ ] 3.1 render-service: G7 exige literal repo: em subreport; ResolvedorDeSubreports + PoliticaDeRecursos
      resolve repo: (cache + G7); preview 400 SUBREPORT_INDISPONIVEL
- [ ] 3.2 G8 no VerificadorDeGates (resolvível + sem ciclo) em /publish/verificar e no publish
- [ ] 3.3 Testes: fatura com entregas (PDF com conteúdo do filho), versão fixa, filho não publicado,
      ciclo, preview com referência quebrada, $P recusado; suítes completas (SQLite/PG) e harness
