/**
 * Página e colunas (Fase 3, bloco 7): formato, margens e a grade multi-coluna
 * para etiquetas A4 em laser (ADR-011 — térmica fora de escopo). O aviso de
 * estouro compara colunas × largura útil.
 */
import { Alert, Group, NumberInput, Select, Stack, Text } from '@mantine/core';
import { datasourceCampo } from '@reportlenz/jrxml-core';
import { useDocumentoStore } from '../store/documentoStore';
import { atualizarPagina, definirFonteDeLinhas } from '../store/mutacoes';
import { areaUtil } from '../canvas/geometria';

export function PainelDaPagina() {
  const template = useDocumentoStore((s) => s.template);
  const mutarTemplate = useDocumentoStore((s) => s.mutarTemplate);
  if (!template) return null;

  const pf = template.pageFormat;
  const util = areaUtil(pf);
  const colecoes = template.dataContract.fields.filter((f) => f.type === 'collection');
  const larguraDasColunas = pf.columnCount * pf.columnWidth + (pf.columnCount - 1) * pf.columnSpacing;
  const estoura = larguraDasColunas > util.width + 0.001;

  const numero = (rotulo: string, valor: number, onChange: (v: number) => void, w = 88) => (
    <NumberInput
      size="xs"
      w={w}
      aria-label={rotulo}
      label={rotulo}
      value={valor}
      onChange={(v) => typeof v === 'number' && onChange(v)}
    />
  );

  return (
    <Stack gap={6} data-testid="painel-da-pagina">
      <Text size="xs" c="dimmed">
        Medidas em pt (72dpi). Multi-coluna monta grade de etiquetas A4 (laser; térmica está fora de escopo).
      </Text>

      <Group gap={6}>
        {numero('Largura', pf.pageWidth, (v) => mutarTemplate(atualizarPagina({ pageWidth: v })))}
        {numero('Altura', pf.pageHeight, (v) => mutarTemplate(atualizarPagina({ pageHeight: v })))}
      </Group>
      <Group gap={6}>
        {numero('Margem esq.', pf.leftMargin, (v) => mutarTemplate(atualizarPagina({ leftMargin: v })), 70)}
        {numero('dir.', pf.rightMargin, (v) => mutarTemplate(atualizarPagina({ rightMargin: v })), 60)}
        {numero('sup.', pf.topMargin, (v) => mutarTemplate(atualizarPagina({ topMargin: v })), 60)}
        {numero('inf.', pf.bottomMargin, (v) => mutarTemplate(atualizarPagina({ bottomMargin: v })), 60)}
      </Group>

      <Text size="xs" fw={600}>
        Colunas (grade de etiquetas)
      </Text>
      <Group gap={6}>
        {numero('Colunas', pf.columnCount, (v) => mutarTemplate(atualizarPagina({ columnCount: Math.max(1, Math.round(v)) })), 70)}
        {numero('Largura col.', pf.columnWidth, (v) => mutarTemplate(atualizarPagina({ columnWidth: v })), 84)}
        {numero('Espaço', pf.columnSpacing, (v) => mutarTemplate(atualizarPagina({ columnSpacing: v })), 70)}
      </Group>
      <Select
        size="xs"
        label="Ordem de preenchimento"
        aria-label="ordem de preenchimento"
        data={[
          { value: 'Vertical', label: 'Vertical (desce a coluna)' },
          { value: 'Horizontal', label: 'Horizontal (atravessa a linha)' },
        ]}
        value={pf.printOrder ?? 'Vertical'}
        onChange={(v) => mutarTemplate(atualizarPagina({ printOrder: v === 'Horizontal' ? 'Horizontal' : undefined }))}
      />

      <Select
        size="xs"
        label="Fonte de linhas"
        aria-label="fonte de linhas"
        description="Grade (ADR-015): cada item da coleção vira uma etiqueta; registro único = payload inteiro é uma linha"
        data={[
          { value: '', label: 'Registro único (padrão)' },
          ...colecoes.map((f) => ({ value: f.name, label: `Coleção "${f.name}" (1 item = 1 linha)` })),
        ]}
        value={datasourceCampo(template) ?? ''}
        onChange={(v) => mutarTemplate(definirFonteDeLinhas(v ?? undefined))}
      />

      <Text size="xs" c="dimmed">
        Útil: {Math.round(util.width)}pt · colunas ocupam {Math.round(larguraDasColunas)}pt
      </Text>
      {estoura && (
        <Alert color="orange" p="xs" data-testid="aviso-estouro-colunas">
          <Text size="xs">As colunas excedem a largura útil — o engine recusaria; ajuste largura/espaçamento.</Text>
        </Alert>
      )}
    </Stack>
  );
}
