# Change: phase-0-extract-jrxml-core

## Why
ReportLenz precisa de um núcleo de domínio (parser/serializer/validador JRXML 7) independente de framework,
extraído do fork Vue `jrxml_web_designer`, antes de qualquer trabalho de UI ou render. É o ativo durável
(Constituição I-1, I-7) e a fundação de todas as fases seguintes.

## What Changes
- Criar o pacote TypeScript headless `jrxml-core` (sem Vue/React/DOM).
- Extrair do fork a lógica de parse/serialize; ajustar o **serializer ao dialeto JRXML 7** (ADR-002).
- Implementar validação dupla: XSD 7 + contrato (anti-Pull).
- Implementar extrator de contrato (`extractContract`).
- Suíte de round-trip (Vitest) com JRXMLs 7 de referência.

## Impact
- Affected specs: `jrxml-core` (nova capability)
- Affected code: novo repo/pacote `jrxml-core`; o fork Vue passa a (opcionalmente) consumir o core.
- ADRs: ADR-002, ADR-004, ADR-003. RFC: RFC-001.
- **Pré-requisito** das fases 1–4.
