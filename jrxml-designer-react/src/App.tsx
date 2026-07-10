/**
 * Casca do designer (RFC-004 §2) — tarefa phase-2/1.1: shell Mantine com o
 * store do documento plugado no jrxml-core. Canvas, painéis e preview chegam
 * nos blocos 2-5.
 */
import { AppShell, Badge, Button, Group, Stack, Text, Title } from '@mantine/core';
import { REFERENCE_TEMPLATES } from '@reportlenz/jrxml-core';
import { useDocumentoStore } from './store/documentoStore';

export function App() {
  const template = useDocumentoStore((s) => s.template);
  const novoDocumento = useDocumentoStore((s) => s.novoDocumento);

  return (
    <AppShell header={{ height: 48 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="xs">
            <Title order={4}>ReportLenz</Title>
            <Badge variant="light">designer</Badge>
          </Group>
          {template && <Text size="sm" c="dimmed">{template.name}</Text>}
        </Group>
      </AppShell.Header>

      <AppShell.Main>
        {template ? (
          <Stack gap="xs">
            <Text fw={600}>{template.name}</Text>
            <Text size="sm" c="dimmed">
              {template.dataContract.fields.length} campos · {template.dataContract.parameters.length} parâmetros ·{' '}
              {template.bands.detail.length} banda(s) detail
            </Text>
            <Text size="sm" c="dimmed">
              O canvas chega no bloco 2; este shell prova o ciclo store ⇄ jrxml-core.
            </Text>
          </Stack>
        ) : (
          <Stack gap="sm" maw={480}>
            <Title order={3}>Novo template</Title>
            <Text size="sm" c="dimmed">
              Comece por um template de referência pt-BR (a galeria completa chega na tarefa 7.2).
            </Text>
            <Group>
              {Object.entries(REFERENCE_TEMPLATES).map(([nome, ref]) => (
                <Button key={nome} variant="light" onClick={() => novoDocumento(structuredClone(ref))}>
                  {nome}
                </Button>
              ))}
            </Group>
          </Stack>
        )}
      </AppShell.Main>
    </AppShell>
  );
}
