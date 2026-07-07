# ADR-012 — Plano B: embarcar JasperReports Web Studio (contingência)

- **Status:** Rejected (mantido como contingência registrada)
- **Data:** 2026-06-28
- **Relacionado:** ADR-001, ADR-005

## Contexto

O Jaspersoft já construiu um **designer JRXML 100% web** — o JasperReports Web Studio — deployável como
app standalone (ZIP Linux/Windows/macOS) ou integrado a um JasperReports Server, com suporte a **Docker** e
**whitelabeling**. Seu changelog comercial já inclui drag-and-drop de campo, Expression Editor, validação
do modelo de dataset, prompts de parâmetros, seleção de imagem/subreport e copy/paste.

Isso prova que a categoria é viável e levanta a pergunta honesta: **construir vs. embarcar?**

## Decisão

**Rejeitado como caminho principal**, mas **registrado como plano B** para evitar a síndrome de
"reconstruí o Jaspersoft inteiro".

### Por que rejeitado como principal
1. **É comercial.** O Web Studio faz parte da edição comercial (junto com Server e IO) — não é community.
   Embarcá-lo exige licença paga e cria dependência de fornecedor.
2. **Não é contract-first.** Como todo o ecossistema Jasper, é Query/Pull-cêntrico (Query Editor, metadata
   JDBC, Query Preview). Isso **fere o invariante I-3** e elimina a tese de diferenciação de ReportLenz.
3. **Sem controle.** Não dá para impor a proibição de Pull, o contrato-primeiro, nem a integração com
   Archbase/Gestor-RQ.
4. **Restrição de licença** (ADR-006): não derivar de artefatos da suite comercial.

### Quando reconsiderar (gatilho do plano B)
Se o esforço de **igualar a paridade de features** do Web Studio (Fases 2–3) explodir além do orçamento
aceitável, a alternativa honesta é **integrar/embarcar o Web Studio comercial** (Docker + whitelabel) como
designer, abrindo mão do contract-first — uma troca estratégica que exigiria revisar a Constituição (I-3).

## Consequências

- Mantém um "fallback" explícito e documentado, evitando over-engineering cego.
- O gatilho é objetivo: estouro de esforço de paridade na UI.
- A decisão de acionar o plano B **não é tática** — implica revisar invariante e seria um novo ADR
  constitucional.
