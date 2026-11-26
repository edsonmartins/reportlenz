# Tasks — seguranca-expressoes

- [x] 1.1 ADR-016 + pacote OpenSpec (proposal/spec/tasks)
- [x] 1.2 VerificadorDeExpressoes: tokenizador + allowlist (tokens, tipos, pacotes, membros, params de
      sistema) e checagens estruturais; ErroDeRender.ExpressaoProibida → 400 EXPRESSAO_PROIBIDA
- [x] 1.3 CompiladorJrxml aplica G7 antes do compile; VerificadorDeGates expõe G7
- [x] 1.4 ContextoJasperRestrito no fill/export (subreport por localização recusado, filesystem off, URL
      só http(s) com prefixo de REPORTLENZ_RECURSOS_URLS_PERMITIDAS; classpath só do engine)
- [x] 1.5 Batch só com templateCodename publicado (400 JRXML_BRUTO_PROIBIDO); testes do batch publicam antes
- [x] 1.6 Testes: cenários do spec (RCE, JDBC, fuga, params de sistema, scriptlet, publish G7, subreport,
      imagem local, fontes, vocabulário legítimo) + suíte completa verde
