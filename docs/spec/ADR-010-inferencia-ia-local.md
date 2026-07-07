# ADR-010 — Inferência de IA local para assistência de design

- **Status:** Proposed
- **Data:** 2026-06-28
- **Relacionado:** I-4 (Constituição), RFC-005

## Contexto

O mercado de designers de relatório já incorpora IA no editor (o Stimulsoft "agora inclui funcionalidade
de IA integrada"). Para ReportLenz, a IA é assistência de design, não geração de dados de cliente. Há
infraestrutura local disponível (GPU RTX 3060 12GB em servidor Ubuntu; Mac Mini M4 16GB). O invariante I-4
(soberania de inferência) exige preferência por inferência local quando o input contém layout de cliente,
contrato de dados ou dados de exemplo.

## Decisão (proposta)

Oferecer dois assistentes de IA, rodando em **inferência local** por padrão:

1. **NL → JRXML inicial**: recebe descrição em linguagem natural **+ o contrato de dados** e emite um
   JRXML inicial. Ex.: *"comprovante de entrega com cabeçalho da Rio Quality, dados do cliente, lista de
   itens, área de assinatura e QR do pedido"* → esqueleto de bandas + elementos + bindings ao contrato.
2. **NL → expressão JR válida**: traduz linguagem natural para expressão JasperReports
   (`$F{}`, `$P{}`, `$V{}`) válida, usando o contrato como vocabulário.

### Restrições
- **Inferência local por padrão** (I-4): layout, contrato e dados de exemplo não saem para nuvem de
  terceiros sem decisão explícita e consentimento.
- O JRXML gerado **passa pela mesma validação** (XSD + contrato) de qualquer template — IA não fura gates
  (ADR-009).
- A IA **respeita o contract-first** (ADR-003): nunca gera `<queryString>`.

## Status e razão de "Proposed"

Marcado **Proposed** (não Accepted) porque é Fase 4 e depende das fases anteriores estarem maduras.
Capacidade dos modelos locais para gerar JRXML 7 válido precisa de validação empírica (spike) antes de
virar Accepted.

## Consequências

- Acelera a criação (esqueleto pronto + expressões assistidas), reduzindo a curva do dialeto JR.
- Coerente com LGPD e com a infra local existente.
- **Custo/risco**: qualidade do JRXML gerado por modelo local é incerta; mitigado pela validação
  obrigatória pós-geração e por tratar a saída da IA como *draft* sempre editável.
