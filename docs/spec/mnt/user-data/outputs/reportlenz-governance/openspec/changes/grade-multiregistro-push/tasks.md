# Tasks — grade-multiregistro-push

## 1. Core (jrxml-core)
- [x] 1.1 Modelo: `datasourceCampo` derivado de `properties['reportlenz.datasource.campo']` (helper) +
      regra de contrato (só a coleção-datasource como field; demais topo = parameters)
- [x] 1.2 Serializer: `<field>` mestre a partir dos itemFields quando a property está ativa
- [x] 1.3 Parser/extractContract: reconstruir coleção + itemFields a partir da property (round-trip)
- [x] 1.4 validateContract/avaliarGates: escopo das bandas = itemFields (+builtins/params/vars);
      erros orientando field escalar de topo → parameter

## 2. Render-service
- [ ] 2.1 PipelineDeRender: datasource = `payload[campo]` (item achatado + coagido); topo → `$P{}` só
- [ ] 2.2 Teste de qualidade: grade 3×3 de etiquetas via `/render/preview` (payload com 9 itens)

## 3. Designer
- [ ] 3.1 Aba Página: select "Fonte de linhas" (registro único | campo-coleção) com auto-explicação
- [ ] 3.2 dadosDeExemplo: N itens (ex.: 9) quando a coleção-datasource está ativa; preview em grade
- [ ] 3.3 REFERENCIA_ETIQUETA_A4 migrada para o novo arranjo (harness 4/4 + fixtures)

## 4. IA
- [ ] 4.1 PromptDoAssistente: relatório de unidade repetida usa a property + coleção (re-medir spike
      nos casos de etiqueta)

## 5. Aceite
- [ ] 5.1 Cenários da spec verdes (grade de ponta a ponta: designer → preview → batch); nota de design
      encerrando a pendência da nota-007 §4
