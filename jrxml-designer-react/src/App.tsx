/**
 * Casca do designer (RFC-004 §2) — tarefa phase-2/1.1: shell Mantine com o
 * store do documento plugado no jrxml-core. Canvas, painéis e preview chegam
 * nos blocos 2-5.
 */
import { ActionIcon, AppShell, Badge, Button, Group, Stack, Text, Title, Tooltip } from '@mantine/core';
import { REFERENCE_TEMPLATES } from '@reportlenz/jrxml-core';
import { Canvas } from './canvas/Canvas';
import { useCanvasStore } from './store/canvasStore';
import { useDocumentoStore } from './store/documentoStore';

/** Barra de ferramentas do canvas (zoom, grid) — tooltips desde já (RFC-004 §9). */
function BarraDoCanvas() {
  const zoom = useCanvasStore((s) => s.zoom);
  const definirZoom = useCanvasStore((s) => s.definirZoom);
  const mostrarGrid = useCanvasStore((s) => s.mostrarGrid);
  const alternarGrid = useCanvasStore((s) => s.alternarGrid);
  const snapAtivo = useCanvasStore((s) => s.snapAtivo);
  const alternarSnap = useCanvasStore((s) => s.alternarSnap);

  return (
    <Group gap="xs" px="md" py={6} style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
      <Tooltip label="Diminuir zoom">
        <ActionIcon variant="subtle" aria-label="diminuir zoom" onClick={() => definirZoom(zoom - 0.25)}>
          −
        </ActionIcon>
      </Tooltip>
      <Text size="sm" w={48} ta="center" data-testid="zoom-atual">
        {Math.round(zoom * 100)}%
      </Text>
      <Tooltip label="Aumentar zoom">
        <ActionIcon variant="subtle" aria-label="aumentar zoom" onClick={() => definirZoom(zoom + 0.25)}>
          +
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Mostrar/ocultar grid (o snap usa o passo do grid)">
        <Button size="compact-xs" variant={mostrarGrid ? 'filled' : 'default'} onClick={alternarGrid}>
          Grid
        </Button>
      </Tooltip>
      <Tooltip label="Snap: gruda em bordas/centros vizinhos e no grid (Alt ignora durante o arraste)">
        <Button size="compact-xs" variant={snapAtivo ? 'filled' : 'default'} onClick={alternarSnap}>
          Snap
        </Button>
      </Tooltip>
    </Group>
  );
}

export function App() {
  const template = useDocumentoStore((s) => s.template);
  const novoDocumento = useDocumentoStore((s) => s.novoDocumento);
  const problemas = useDocumentoStore((s) => s.problemas);

  return (
    <AppShell header={{ height: 48 }} padding={0}>
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="xs">
            <Title order={4}>ReportLenz</Title>
            <Badge variant="light">designer</Badge>
          </Group>
          {template && (
            <Group gap="xs">
              <Text size="sm" c="dimmed">
                {template.name}
              </Text>
              <Badge color={problemas.length === 0 ? 'green' : 'red'} variant="light">
                {problemas.length === 0 ? 'ok' : `${problemas.length} problema(s)`}
              </Badge>
            </Group>
          )}
        </Group>
      </AppShell.Header>

      <AppShell.Main style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px)' }}>
        {template ? (
          <>
            <BarraDoCanvas />
            <div style={{ flex: 1, minHeight: 0 }}>
              <Canvas />
            </div>
          </>
        ) : (
          <Stack gap="sm" maw={480} p="md">
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
