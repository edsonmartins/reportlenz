# ADR-021 — Filtro de classes nativo do engine como segunda barreira (defesa em profundidade do G7)

- **Status:** Accepted (pedido do usuário em 2026-11-26)
- **Data:** 2026-11-26
- **Relacionado:** ADR-016 (G7 + contexto restrito), ADR-008 (compile cache compartilhado), nota-010 §4
  (risco residual nº 1), validação contra a JasperReports 7.1.1 (2026-11-26)
- **Implementa:** `openspec/changes/filtro-de-classes-do-engine`

## Contexto

O G7 (ADR-016) barra expressões perigosas **antes do compile**. Duas situações escapam dele:

1. **Compile cache compartilhado (ADR-008):** um `JasperReport` serializado gravado direto no Redis não passa
   pelo G7. Era o risco residual nº 1 da nota-010.
2. **Bypass da allowlist léxica:** o G7 é conservador, mas é uma análise léxica. Um erro nele não tinha
   segunda linha de defesa.

A validação contra a 7.1.1 encontrou um recurso nativo do engine que existe desde a 7.0.7:
`net.sf.jasperreports.report.class.filter.enabled`, que vem **desligado** por padrão. Testes empíricos
nas versões 7.0.7 e 7.1.1 mostraram o seguinte:

- com o filtro ligado, `Runtime`, `java.io.File` e `System` são barrados com "Class … is not visible to
  reports";
- o filtro age **no fill**, sobre o relatório já compilado. Um relatório compilado sem filtro, serializado
  e desserializado como no cache foi **bloqueado no fill**;
- a whitelist padrão do engine barra vocabulário legítimo nosso (`java.math.RoundingMode`) e inclui
  `java.sql.Connection`, que só faz sentido no modo Pull.

## Decisão

1. Ligar `net.sf.jasperreports.report.class.filter.enabled=true` no `jasperreports.properties` do
   render-service. O valor vale para o contexto default, do qual o contexto restrito (ADR-016) herda.
2. Acrescentar a whitelist `net.sf.jasperreports.report.class.whitelist.reportlenz` com as classes
   **totalmente qualificadas** do vocabulário do G7:
   - tipos de `java.lang`, `java.math`, `java.text`, `java.time*` e `java.util` permitidos;
   - os datasources Push;
   - as categorias do `jasperreports-functions`: `DateTimeFunctions`, `TextFunctions`, `MathFunctions` e
     `LogicalFunctions`. `ReportFunctions` fica de fora.
3. A whitelist padrão do engine continua ativa. Ela é somada à nossa; não substituímos as entradas da
   JasperReports.
4. Teste de paridade: todo item do vocabulário legítimo aceito pelo G7 **renderiza** com o filtro ligado.
   Se o G7 ganhar um tipo novo sem a classe correspondente na whitelist, o teste falha.

## Alternativas consideradas

- **Só o G7:** deixava o risco do cache em aberto e nenhuma segunda barreira.
- **Assinar (HMAC) as entradas do compile cache:** fecha o risco do cache, mas não o de bypass do G7. Pode
  vir depois, como terceira camada.
- **Substituir a whitelist padrão:** reduziria `java.sql.Connection`, mas as propriedades padrão vêm do jar
  e são somadas por sufixo. Removê-las exigiria sobrescrever cada sufixo e acompanhar cada versão do
  engine. Não vale a fragilidade, porque o G7 já barra `java.sql`.

## Consequências

- Uma classe usada por expressão e ausente da whitelist falha **no render** com "Class X is not visible to
  reports". O teste de paridade pega isso no CI.
- O risco residual nº 1 da nota-010 é rebaixado: um cache envenenado não executa código fora da whitelist.
  Redis privado e com senha continua como requisito, porque o próprio relatório ainda pode ser adulterado.
