# ADR-002 — JRXML 7.0.7 como version target canônico

- **Status:** Accepted
- **Data:** 2026-06-28
- **Relacionado:** ADR-001, ADR-007, RFC-001

## Contexto

A JasperReports Library 7 introduziu uma refatoração maior (migração Jakarta) que **quebrou
compatibilidade retroativa** de forma profunda:

- Os parsers baseados em Apache Commons Digester foram substituídos por serialização Jackson XML.
- Arquivos `.jrxml` e `.jrtx` criados na versão 6 ou anterior **não podem mais ser carregados** pela
  Library 7+ sozinha; a conversão 6↔7 só é feita pelo Jaspersoft Studio 7+.
- A Library foi dividida em múltiplos JARs opcionais; alguns pacotes Java mudaram de nome.
- A 7.0.4 adicionou um filtro de classe de desserialização para corrigir a **CVE-2025-10492**.

A versão 7.0.7 é a mais recente do trilho 7.0.x (release no Maven Central em 2026-05-29), posterior à
7.0.6 (que introduziu o JasperReports Maven Plugin oficial).

## Decisão

Fixar **JRXML 7 / JasperReports Library 7.0.7** como version target canônico de ReportLenz. O
`jrxml-core` (parser/serializer) mira o **dialeto JRXML 7** especificamente. A versão da Library
embarcada no backend **deve casar** com o dialeto emitido pelo designer.

## Consequências

- O parser/serializer do `jrxml-core` nasce mirando o esquema 7. Qualquer designer ou exemplo da era 6.x
  (incluindo possivelmente o fork `jrxml_web_designer`, a verificar) **não serve de molde** para o XML
  emitido — o esquema mudou, não é só versão de atributo.
- Ganha-se o fix da CVE-2025-10492 (desserialização) — relevante porque relatório pode vir de fonte não
  confiável.
- **Migração de legado 6.x → 7.x fica fora de escopo inicial** (Constituição, "Fora de escopo"). Se a Rio
  Quality trouxer JRXMLs legados do Consinco, o caminho de conversão passa pelo Studio desktop; um
  importador 6→7 é trabalho futuro.
- A escolha 7.0.x exige a matriz de dependências modular do ADR-007.

## Política de atualização

Atualizações de patch (7.0.x) são adotadas após validação em staging do parser/serializer contra o novo
esquema. Um salto de minor/major (ex.: 7.1, 8.x) exige novo ADR avaliando quebras de esquema.
