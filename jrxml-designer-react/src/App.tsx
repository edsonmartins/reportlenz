/**
 * Casca do designer (RFC-004 §2) — tarefa phase-2/1.1: shell Mantine com o
 * store do documento plugado no jrxml-core. Canvas, painéis e preview chegam
 * nos blocos 2-5.
 */
import { ActionIcon, AppShell, Badge, Button, Divider, Group, Menu, Text, Title, Tooltip } from '@mantine/core';
import { useState } from 'react';
import { AssistenteDrawer } from './assistente/AssistenteDrawer';
import { Canvas } from './canvas/Canvas';
import { BIBLIOTECA_DE_BLOCOS } from './blocos/biblioteca';
import { PRESETS_DE_ELEMENTO } from './palette/inserir';
import { ReportChecker } from './checker/ReportChecker';
import { DataContractPanel } from './contrato/DataContractPanel';
import { Galeria } from './galeria/Galeria';
import { PreviewPanel } from './preview/PreviewPanel';
import { usePreviewStore } from './preview/previewStore';
import { PainelDePropriedades } from './props/PainelDePropriedades';
import { PublishWizard } from './publish/PublishWizard';
import { useCanvasStore } from './store/canvasStore';
import { useDocumentoStore } from './store/documentoStore';
import { bandaComum } from './store/mutacoes';

/** Comandos de multi-seleção (2.5): alinhar (≥2), distribuir (≥3), z-order (≥1). */
function ComandosDeSelecao() {
  const selecao = useDocumentoStore((s) => s.selecao);
  const alinharSelecao = useDocumentoStore((s) => s.alinharSelecao);
  const distribuirSelecao = useDocumentoStore((s) => s.distribuirSelecao);
  const zOrderSelecao = useDocumentoStore((s) => s.zOrderSelecao);

  const mesmaBanda = bandaComum(selecao) !== null;
  const podeAlinhar = mesmaBanda && selecao.length >= 2;
  const podeDistribuir = mesmaBanda && selecao.length >= 3;
  const temSelecao = selecao.length >= 1 && mesmaBanda;

  const botao = (rotulo: string, dica: string, habilitado: boolean, acao: () => void) => (
    <Tooltip label={dica} key={rotulo}>
      <Button size="compact-xs" variant="default" disabled={!habilitado} onClick={acao}>
        {rotulo}
      </Button>
    </Tooltip>
  );

  return (
    <Group gap={4}>
      <Divider orientation="vertical" />
      {botao('⊏', 'Alinhar esquerdas (seleção na mesma banda)', podeAlinhar, () => alinharSelecao('esquerda'))}
      {botao('⊓', 'Alinhar topos', podeAlinhar, () => alinharSelecao('topo'))}
      {botao('⊐', 'Alinhar direitas', podeAlinhar, () => alinharSelecao('direita'))}
      {botao('⊔', 'Alinhar bases', podeAlinhar, () => alinharSelecao('base'))}
      {botao('⫞', 'Centralizar na horizontal', podeAlinhar, () => alinharSelecao('centroH'))}
      {botao('⫟', 'Centralizar na vertical', podeAlinhar, () => alinharSelecao('centroV'))}
      <Divider orientation="vertical" />
      {botao('⇹', 'Distribuir horizontalmente (3+)', podeDistribuir, () => distribuirSelecao('horizontal'))}
      {botao('⇳', 'Distribuir verticalmente (3+)', podeDistribuir, () => distribuirSelecao('vertical'))}
      <Divider orientation="vertical" />
      {botao('▲', 'Trazer para frente (ordem de pintura do JRXML)', temSelecao, () => zOrderSelecao('frente'))}
      {botao('▼', 'Enviar para trás', temSelecao, () => zOrderSelecao('tras'))}
    </Group>
  );
}

/** Barra de ferramentas do canvas (zoom, grid) — tooltips desde já (RFC-004 §9). */
function BarraDoCanvas() {
  const [assistenteAberto, setAssistenteAberto] = useState(false);
  const [publishAberto, setPublishAberto] = useState(false);
  const zoom = useCanvasStore((s) => s.zoom);
  const definirZoom = useCanvasStore((s) => s.definirZoom);
  const mostrarGrid = useCanvasStore((s) => s.mostrarGrid);
  const alternarGrid = useCanvasStore((s) => s.alternarGrid);
  const snapAtivo = useCanvasStore((s) => s.snapAtivo);
  const alternarSnap = useCanvasStore((s) => s.alternarSnap);
  const podeDesfazer = useDocumentoStore((s) => s.passado.length > 0);
  const podeRefazer = useDocumentoStore((s) => s.futuro.length > 0);
  const desfazer = useDocumentoStore((s) => s.desfazer);
  const refazer = useDocumentoStore((s) => s.refazer);

  return (
    <Group gap="xs" px="md" py={6} style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
      <Tooltip label="Desfazer (Ctrl+Z)">
        <ActionIcon variant="subtle" aria-label="desfazer" disabled={!podeDesfazer} onClick={desfazer}>
          ↶
        </ActionIcon>
      </Tooltip>
      <Tooltip label="Refazer (Ctrl+Shift+Z ou Ctrl+Y)">
        <ActionIcon variant="subtle" aria-label="refazer" disabled={!podeRefazer} onClick={refazer}>
          ↷
        </ActionIcon>
      </Tooltip>
      <Divider orientation="vertical" />
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
      <Divider orientation="vertical" />
      <Menu shadow="md" width={260} transitionProps={{ duration: 0 }}>
        <Menu.Target>
          <Tooltip label="Inserir elemento na banda selecionada (ou na primeira detail)">
            <Button size="compact-xs" variant="light">
              + Inserir
            </Button>
          </Tooltip>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>Básicos</Menu.Label>
          {PRESETS_DE_ELEMENTO.filter((p) => p.grupo === 'básicos').map((p) => (
            <Menu.Item key={p.rotulo} onClick={() => useDocumentoStore.getState().inserirElemento(p.criar())}>
              {p.rotulo}
            </Menu.Item>
          ))}
          <Menu.Label>Código de barras (perfis pt-BR)</Menu.Label>
          {PRESETS_DE_ELEMENTO.filter((p) => p.grupo === 'barcode').map((p) => (
            <Menu.Item key={p.rotulo} onClick={() => useDocumentoStore.getState().inserirElemento(p.criar())}>
              {p.rotulo}
            </Menu.Item>
          ))}
          <Menu.Label>Blocos (mesclam o contrato)</Menu.Label>
          {BIBLIOTECA_DE_BLOCOS.map((b) => (
            <Tooltip key={b.id} label={b.descricao} position="left">
              <Menu.Item onClick={() => useDocumentoStore.getState().inserirBloco(b)}>{b.rotulo}</Menu.Item>
            </Tooltip>
          ))}
        </Menu.Dropdown>
      </Menu>
      <ComandosDeSelecao />
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
        <Tooltip label="Gerar/refinar o relatório descrevendo em português (a saída é um rascunho revisável — RFC-005)">
          <Button size="compact-xs" color="violet" variant="light" onClick={() => setAssistenteAberto(true)}>
            ✨ Assistente
          </Button>
        </Tooltip>
        <Tooltip label="Render REAL pelo engine JasperReports (a verdade; o canvas é aproximação)">
          <Button
            size="compact-xs"
            color="green"
            variant="light"
            onClick={() => {
              usePreviewStore.getState().abrir();
              void usePreviewStore.getState().renderizar(0);
            }}
          >
            Renderizar (Jasper)
          </Button>
        </Tooltip>
        <Tooltip label="Gates G1–G6 (RFC-006): publish só com todos verdes, confirmados pela Library real">
          <Button size="compact-xs" variant="light" onClick={() => setPublishAberto(true)}>
            Publicar…
          </Button>
        </Tooltip>
      </div>
      <AssistenteDrawer aberto={assistenteAberto} onFechar={() => setAssistenteAberto(false)} />
      <PublishWizard aberto={publishAberto} onFechar={() => setPublishAberto(false)} />
    </Group>
  );
}

export function App() {
  const template = useDocumentoStore((s) => s.template);
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
              <Tooltip label="Validação contínua: dialeto 7 + integridade com o contrato (detalhes no painel Problemas)">
                <Badge color={problemas.length === 0 ? 'green' : 'red'} variant="light">
                  {problemas.length === 0 ? 'ok' : `${problemas.length} problema(s)`}
                </Badge>
              </Tooltip>
            </Group>
          )}
        </Group>
      </AppShell.Header>

      <AppShell.Main style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px)' }}>
        {template ? (
          <>
            <BarraDoCanvas />
            <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
              <DataContractPanel />
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 1, minHeight: 0 }}>
                  <Canvas />
                </div>
                <ReportChecker />
              </div>
              <PainelDePropriedades />
              <PreviewPanel />
            </div>
          </>
        ) : (
          <Galeria />
        )}
      </AppShell.Main>
    </AppShell>
  );
}
