# Change: phase-4-ai-governance

## Why
Com o designer maduro (Fases 0–3), a Fase 4 adiciona o assistente de IA local (acelera criação de
templates e expressões, alinhado a LGPD) e formaliza os gates de governança e o repositório de templates
(versionamento, ciclo de vida, biblioteca de blocos). Fecha o princípio spec-driven em produto.

## What Changes
- Assistente A: **NL → JRXML inicial** (descrição + contrato → draft validado).
- Assistente B: **NL → expressão JR** válida (contra o contrato).
- Inferência **local por padrão** (I-4, ADR-010); validação obrigatória pós-geração; saída sempre draft.
- Gates de governança G1–G6 no publish (XSD, anti-Pull, integridade de expressão, dialeto, contrato, hash).
- Ciclo de vida do template (draft→published→deprecated) + auditoria.
- Biblioteca de blocos reutilizáveis com mescla de contrato.

## Impact
- Affected specs: `ai-assist` (nova), `template-governance` (nova)
- Affected code: serviço de inferência local; gates no repositório; auditoria no PostgreSQL.
- ADR: ADR-010. RFCs: RFC-005, RFC-006.
- Depende de: phase-1 (contrato/render), phase-3 (editor pro).
- ADR-010 promovido de Proposed→Accepted somente após spike de qualidade do JRXML gerado.
