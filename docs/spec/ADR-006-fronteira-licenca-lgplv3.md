# ADR-006 — Fronteira de licença LGPLv3

- **Status:** Accepted
- **Data:** 2026-06-28
- **Relacionado:** I-6 (Constituição), ADR-001, ADR-002

## Contexto

A JasperReports Library é distribuída sob **LGPLv3** (confirmado em Maven Central, libraries.io e na
página da community edition). O produto ReportLenz é proprietário/fechado. É preciso definir a fronteira
que mantém o produto fechado sem violar a LGPL.

Pontos confirmados:
- A **JasperReports Library** (engine) é community/LGPLv3.
- O **Jaspersoft Studio desktop** é community.
- **JasperReports Server, Web Studio e IO** são **comerciais** (o Server community foi descontinuado).

## Decisão

A JasperReports Library é consumida **estritamente como dependência** (`compile`), em uso **server-side**,
sob as seguintes regras invioláveis:

1. **Não modificar** os fontes da Library. Nenhum patch em parser, exportador ou qualquer classe Jasper.
2. **Não redistribuir** o JAR da Library a terceiros como parte de um produto distribuído. O uso é em
   servidor próprio (SaaS/on-premises do cliente operado por nós).
3. Todo código próprio (`jrxml-core`, UI, serviço de render) vive **fora** da Library, chamando apenas a
   sua API pública.
4. Atribuição: documentar que o produto usa JasperReports Library (LGPLv3) na página de licenças/sobre.

## Fundamentação

O gatilho de copyleft da LGPL é **modificar e distribuir** a biblioteca, não usá-la como dependência. Uso
server-side, sem alteração e sem distribuição do binário a terceiros, mantém o código próprio fechado —
mesmo cenário da dúvida clássica da comunidade sobre empacotar o JAR (enquanto não se modifica os fontes
e se consome como lib, o código próprio permanece próprio).

## Consequências

- Produto fechado viável com engine livre.
- A fronteira `jrxml-core` separado (ADR-004) **já garante** que nenhuma customização toque a Library.
- **Restrições adicionais:**
  - Não inspecionar/derivar de artefatos da **suite comercial** (Web Studio/Server/IO) ao construir o
    designer. A referência de UX é permitida; derivar código não.
  - O designer é derivado do **esquema JRXML público** e da **API da Library (LGPL)**, não de produtos
    comerciais.
- Se algum dia for **necessário modificar** a Library, isso exige ADR específico e aciona obrigação de
  disponibilizar as modificações sob LGPL.

## Revisão

Reavaliar a cada major bump da Library, pois termos e modularização podem mudar.
