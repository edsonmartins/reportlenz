/**
 * Galeria de templates iniciais pt-BR (ADR-005/RFC-004 §9, tarefa phase-2/7.2):
 * o "novo template" começa de um modelo pronto (ou em branco) — nunca de uma
 * tela intimidadora. Os modelos são os templates de referência do jrxml-core
 * (os mesmos validados pelo harness na Library real).
 */
import { Badge, Button, Card, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import type { ReportTemplate } from '@reportlenz/jrxml-core';
import { REFERENCE_TEMPLATES } from '@reportlenz/jrxml-core';
import { useDocumentoStore } from '../store/documentoStore';

/** Template em branco: A4 com uma banda detail vazia e contrato vazio. */
export function criarTemplateEmBranco(): ReportTemplate {
  return {
    name: 'novo_relatorio',
    pageFormat: {
      pageWidth: 595,
      pageHeight: 842,
      orientation: 'Portrait',
      leftMargin: 20,
      rightMargin: 20,
      topMargin: 30,
      bottomMargin: 30,
      columnCount: 1,
      columnWidth: 555,
      columnSpacing: 0,
    },
    properties: {},
    styles: [],
    dataContract: { fields: [], parameters: [], variables: [] },
    bands: {
      detail: [{ height: 100, splitType: 'Stretch', elements: [] }],
      groups: [],
    },
  };
}

interface Modelo {
  chave: string;
  titulo: string;
  descricao: string;
  criar: () => ReportTemplate;
}

const MODELOS: Modelo[] = [
  {
    chave: 'em_branco',
    titulo: 'Em branco',
    descricao: 'Página A4 vazia com uma banda de detalhe. Declare o contrato e monte do zero.',
    criar: criarTemplateEmBranco,
  },
  {
    chave: 'fatura',
    titulo: 'Fatura',
    descricao: 'Fatura A4 com grupo por categoria, tabela de itens zebrada, QR e sub-relatório de entregas.',
    criar: () => structuredClone(REFERENCE_TEMPLATES['fatura']!),
  },
  {
    chave: 'comprovante',
    titulo: 'Comprovante de entrega',
    descricao: 'Pedido e cliente agrupados (nomes pontuados), tabela de itens e QR de conferência.',
    criar: () => structuredClone(REFERENCE_TEMPLATES['comprovante']!),
  },
  {
    chave: 'formulario',
    titulo: 'Formulário (ficha)',
    descricao: 'Ficha cadastral com rótulos e campos, datas em dd/MM/yyyy e observações elásticas.',
    criar: () => structuredClone(REFERENCE_TEMPLATES['formulario']!),
  },
  {
    chave: 'etiqueta_a4',
    titulo: 'Etiqueta A4 (3 colunas)',
    descricao: 'Grade de etiquetas para impressora laser com EAN-13 e preço. (Térmica está fora de escopo.)',
    criar: () => structuredClone(REFERENCE_TEMPLATES['etiqueta_a4']!),
  },
];

export function Galeria() {
  const novoDocumento = useDocumentoStore((s) => s.novoDocumento);

  return (
    <Stack gap="sm" p="md" maw={860}>
      <Title order={3}>Novo template</Title>
      <Text size="sm" c="dimmed">
        Comece por um modelo pt-BR — todos contract-first (o relatório declara os campos que espera; os dados
        chegam prontos, sem query embutida).
      </Text>
      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm" data-testid="galeria">
        {MODELOS.map((m) => {
          const t = m.criar();
          return (
            <Card key={m.chave} withBorder padding="sm" data-testid={`modelo-${m.chave}`}>
              <Stack gap={6} h="100%" justify="space-between">
                <div>
                  <Group gap={6} mb={4}>
                    <Text fw={600} size="sm">
                      {m.titulo}
                    </Text>
                    {t.pageFormat.columnCount > 1 && (
                      <Badge size="xs" variant="light" color="violet">{`${t.pageFormat.columnCount} colunas`}</Badge>
                    )}
                  </Group>
                  <Text size="xs" c="dimmed">
                    {m.descricao}
                  </Text>
                </div>
                <Group justify="space-between" align="center">
                  <Text size="xs" c="dimmed">
                    {t.dataContract.fields.length} campo(s) · {t.bands.groups.length} grupo(s)
                  </Text>
                  <Button size="compact-xs" variant="light" onClick={() => novoDocumento(m.criar())}>
                    Usar
                  </Button>
                </Group>
              </Stack>
            </Card>
          );
        })}
      </SimpleGrid>
    </Stack>
  );
}
