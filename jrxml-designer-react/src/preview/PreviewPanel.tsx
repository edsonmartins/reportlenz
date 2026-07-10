/**
 * PreviewPanel (RFC-004 §7, tarefa phase-2/5.2): o render REAL via Jasper,
 * lado a lado com o canvas. A aproximação é o canvas (rotulada, 5.1); isto
 * aqui é a verdade do engine.
 */
import { ActionIcon, Alert, Badge, Button, Group, Loader, ScrollArea, Stack, Text } from '@mantine/core';
import { usePreviewStore } from './previewStore';

export function PreviewPanel() {
  const aberto = usePreviewStore((s) => s.aberto);
  const carregando = usePreviewStore((s) => s.carregando);
  const erro = usePreviewStore((s) => s.erro);
  const violacoes = usePreviewStore((s) => s.violacoes);
  const imagemUrl = usePreviewStore((s) => s.imagemUrl);
  const totalPaginas = usePreviewStore((s) => s.totalPaginas);
  const pagina = usePreviewStore((s) => s.pagina);
  const fechar = usePreviewStore((s) => s.fechar);
  const renderizar = usePreviewStore((s) => s.renderizar);

  if (!aberto) return null;

  return (
    <aside
      data-testid="preview-panel"
      style={{
        width: 380,
        borderLeft: '1px solid var(--mantine-color-gray-3)',
        background: 'var(--mantine-color-gray-0)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <Group justify="space-between" p="sm" pb={4}>
        <Group gap="xs">
          <Text size="sm" fw={600}>
            Render Jasper
          </Text>
          <Badge size="xs" color="green" variant="light">
            verdade do engine
          </Badge>
        </Group>
        <ActionIcon size="sm" variant="subtle" aria-label="fechar preview" onClick={fechar}>
          ×
        </ActionIcon>
      </Group>

      <Group px="sm" gap="xs">
        <Button size="compact-xs" variant="light" onClick={() => void renderizar(pagina)} disabled={carregando}>
          Renderizar novamente
        </Button>
        {totalPaginas > 1 && (
          <Group gap={4}>
            <ActionIcon
              size="sm"
              variant="subtle"
              aria-label="página anterior"
              disabled={pagina <= 0 || carregando}
              onClick={() => void renderizar(pagina - 1)}
            >
              ‹
            </ActionIcon>
            <Text size="xs" data-testid="preview-paginacao">
              {pagina + 1} / {totalPaginas}
            </Text>
            <ActionIcon
              size="sm"
              variant="subtle"
              aria-label="próxima página"
              disabled={pagina >= totalPaginas - 1 || carregando}
              onClick={() => void renderizar(pagina + 1)}
            >
              ›
            </ActionIcon>
          </Group>
        )}
      </Group>

      <ScrollArea style={{ flex: 1 }} p="sm">
        {carregando && (
          <Group gap="xs">
            <Loader size="xs" />
            <Text size="xs" c="dimmed">
              renderizando no engine…
            </Text>
          </Group>
        )}
        {erro && (
          <Alert color="red" title="Render recusado" data-testid="preview-erro">
            <Stack gap={4}>
              <Text size="xs">{erro}</Text>
              {violacoes.map((v, i) => (
                <Text size="xs" key={i} c="red.8">
                  • {v}
                </Text>
              ))}
            </Stack>
          </Alert>
        )}
        {imagemUrl && !carregando && !erro && (
          <img
            data-testid="preview-img"
            src={imagemUrl}
            alt={`render Jasper — página ${pagina + 1}`}
            style={{ width: '100%', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }}
          />
        )}
      </ScrollArea>
    </aside>
  );
}
