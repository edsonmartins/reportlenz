/**
 * Área de trabalho do designer (RFC-004 §2, ADR-024/ADR-025): abas Editor e
 * Preview, barras de ferramentas e galeria — o MIOLO usado tanto pela SPA de
 * homologação quanto pelo componente `<ReportLenzDesigner>`. Ocupa 100% do
 * contêiner; quem define a altura é quem hospeda.
 */
import { ActionIcon, Alert, Badge, Button, Divider, Group, Menu, Stack, Tabs, Text, Tooltip } from '@mantine/core';
import { buildInputSchema, extractContract, serializeJrxml } from '@reportlenz/jrxml-core';
import { useState } from 'react';
import { AssistenteDrawer } from '../assistente/AssistenteDrawer';
import { Canvas } from '../canvas/Canvas';
import { BIBLIOTECA_DE_BLOCOS } from '../blocos/biblioteca';
import { PRESETS_DE_ELEMENTO } from '../palette/inserir';
import { ReportChecker } from '../checker/ReportChecker';
import { DataContractPanel } from '../contrato/DataContractPanel';
import { Galeria } from '../galeria/Galeria';
import { AbaDePreview } from '../preview/AbaDePreview';
import { useInstancia } from '../instancia';
import { usePreviewStore, type Aba } from '../preview/previewStore';
import { PainelDePropriedades } from '../props/PainelDePropriedades';
import { PublishWizard } from '../publish/PublishWizard';
import { useCanvasStore } from '../store/canvasStore';
import { useDocumentoStore } from '../store/documentoStore';
import { bandaComum } from '../store/mutacoes';
import { criarTemplateEmBranco } from '../galeria/Galeria';
import { codenameDoRegistro, useIntegracao } from './integracao';

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

/** Avisos da mescla de mini-contrato ao inserir bloco (phase-4/6.2) — nunca silenciosos. */
function AvisosDeBloco() {
  const avisos = useDocumentoStore((s) => s.avisosDeBloco);
  const limpar = useDocumentoStore((s) => s.limparAvisosDeBloco);
  if (avisos.length === 0) return null;
  return (
    <Alert color="yellow" p="xs" m={4} withCloseButton onClose={limpar} data-testid="avisos-de-bloco">
      {avisos.map((a, i) => (
        <Text size="xs" key={i}>
          • {a}
        </Text>
      ))}
    </Alert>
  );
}

/** Barra de ferramentas do canvas (zoom, grid) — tooltips desde já (RFC-004 §9). */
function BarraDoCanvas() {
  const instancia = useInstancia();
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
            <Menu.Item key={p.rotulo} onClick={() => instancia.documento.getState().inserirElemento(p.criar())}>
              {p.rotulo}
            </Menu.Item>
          ))}
          <Menu.Label>Código de barras (perfis pt-BR)</Menu.Label>
          {PRESETS_DE_ELEMENTO.filter((p) => p.grupo === 'barcode').map((p) => (
            <Menu.Item key={p.rotulo} onClick={() => instancia.documento.getState().inserirElemento(p.criar())}>
              {p.rotulo}
            </Menu.Item>
          ))}
          <Menu.Label>Blocos (mesclam o contrato)</Menu.Label>
          {BIBLIOTECA_DE_BLOCOS.map((b) => (
            <Tooltip key={b.id} label={b.descricao} position="left">
              <Menu.Item onClick={() => instancia.documento.getState().inserirBloco(b)}>{b.rotulo}</Menu.Item>
            </Tooltip>
          ))}
        </Menu.Dropdown>
      </Menu>
      <ComandosDeSelecao />
    </Group>
  );
}

/**
 * Abas da área de trabalho (ADR-024) + comandos globais, visíveis nas duas
 * abas: Assistente, Renderizar (leva à aba Preview), Publicar e sessão.
 */
function BarraDaAreaDeTrabalho() {
  const instancia = useInstancia();
  const integracao = useIntegracao();
  const { recursos } = integracao;
  const [assistenteAberto, setAssistenteAberto] = useState(false);
  const [publishAberto, setPublishAberto] = useState(false);
  const [salvamento, setSalvamento] = useState<{ ok: boolean; texto: string } | null>(null);
  const aba = usePreviewStore((s) => s.aba);
  const irPara = usePreviewStore((s) => s.irPara);
  const template = useDocumentoStore((s) => s.template);
  const problemas = useDocumentoStore((s) => s.problemas);

  const salvar = async () => {
    if (!template) return;
    const codename = codenameDoRegistro(integracao, template.name);
    try {
      const resposta = await instancia.api(`/templates/${encodeURIComponent(codename)}/versoes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jrxml: serializeJrxml(template),
          inputSchema: buildInputSchema(extractContract(template), { templateName: codename, version: 1 }),
        }),
      });
      if (!resposta.ok) {
        const corpo = (await resposta.json().catch(() => ({}))) as { mensagem?: string };
        setSalvamento({ ok: false, texto: corpo.mensagem ?? `salvar falhou (HTTP ${resposta.status})` });
        return;
      }
      const salvo = (await resposta.json()) as { version: number; novaVersao: boolean; jrxmlHash: string };
      setSalvamento({ ok: true, texto: `salvo · v${salvo.version}` });
      integracao.onSalvo?.({ codename, versao: salvo.version, novaVersao: salvo.novaVersao, jrxmlHash: salvo.jrxmlHash });
    } catch (e) {
      setSalvamento({ ok: false, texto: `serviço indisponível: ${e instanceof Error ? e.message : String(e)}` });
    }
  };

  return (
    <Group gap="xs" px="md" pt={4} style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }} justify="space-between" wrap="nowrap">
      <Group gap="sm" wrap="nowrap">
        <Tabs value={aba} onChange={(v) => v && irPara(v as Aba)} variant="default">
          <Tabs.List style={{ borderBottom: 0 }}>
            <Tabs.Tab value="editor">Editor</Tabs.Tab>
            <Tabs.Tab value="preview">Preview (Jasper)</Tabs.Tab>
          </Tabs.List>
        </Tabs>
        {template && (
          <Group gap={6} pb={4} wrap="nowrap">
            <Text size="sm" c="dimmed" data-testid="nome-do-template">
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
      <Group gap={8} pb={4} wrap="nowrap">
        {recursos.assistente && (
          <Tooltip label="Gerar/refinar o relatório descrevendo em português (a saída é um rascunho revisável — RFC-005)">
            <Button size="compact-xs" color="violet" variant="light" onClick={() => setAssistenteAberto(true)}>
              ✨ Assistente
            </Button>
          </Tooltip>
        )}
        <Tooltip label="Render REAL pelo engine JasperReports (a verdade; o canvas é aproximação) — abre a aba Preview">
          <Button
            size="compact-xs"
            color="green"
            variant="light"
            onClick={() => {
              // Render primeiro (registra o JRXML pedido), depois a aba — sem render duplicado.
              void instancia.preview.getState().renderizar(0);
              irPara('preview');
            }}
          >
            Renderizar (Jasper)
          </Button>
        </Tooltip>
        {recursos.salvar && (
          <Tooltip label={salvamento?.texto ?? 'Salva o draft no registro (gates de save: G1, G2 e G7)'}>
            <Button size="compact-xs" variant="default" onClick={() => void salvar()} data-testid="salvar">
              Salvar
            </Button>
          </Tooltip>
        )}
        {salvamento && (
          <Badge size="xs" variant="light" color={salvamento.ok ? 'green' : 'red'} data-testid="estado-do-salvamento" maw={260}>
            {salvamento.texto}
          </Badge>
        )}
        {recursos.publicar && (
          <Tooltip label="Gates G1–G8 (RFC-006, ADR-016, ADR-020): publish só com todos verdes, confirmados pela Library real">
            <Button size="compact-xs" variant="light" onClick={() => setPublishAberto(true)}>
              Publicar…
            </Button>
          </Tooltip>
        )}
        {integracao.acoesExtras}
      </Group>
      {recursos.assistente && <AssistenteDrawer aberto={assistenteAberto} onFechar={() => setAssistenteAberto(false)} />}
      {recursos.publicar && <PublishWizard aberto={publishAberto} onFechar={() => setPublishAberto(false)} />}
    </Group>
  );
}

/** Sem documento e sem galeria (ex.: embutido com recursos.galeria=false). */
function SemDocumento() {
  const instancia = useInstancia();
  return (
    <Stack align="center" justify="center" gap="xs" style={{ flex: 1 }} data-testid="sem-documento">
      <Text size="sm" c="dimmed">
        Nenhum template aberto.
      </Text>
      <Button size="xs" variant="light" onClick={() => instancia.documento.getState().novoDocumento(criarTemplateEmBranco())}>
        Novo template em branco
      </Button>
    </Stack>
  );
}

export function AreaDeTrabalho() {
  const template = useDocumentoStore((s) => s.template);
  const aba = usePreviewStore((s) => s.aba);
  const { recursos } = useIntegracao();

  if (!template) {
    return recursos.galeria ? <Galeria /> : <SemDocumento />;
  }
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }} data-testid="area-de-trabalho">
      <BarraDaAreaDeTrabalho />
      {/* Editor fica montado (só oculto) na aba Preview: scroll e seleção preservados. */}
      <div data-testid="aba-editor" style={{ flex: 1, minHeight: 0, display: aba === 'editor' ? 'flex' : 'none', flexDirection: 'column' }}>
        <BarraDoCanvas />
        <AvisosDeBloco />
        <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
          <DataContractPanel />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <div style={{ flex: 1, minHeight: 0 }}>
              <Canvas />
            </div>
            <ReportChecker />
          </div>
          <PainelDePropriedades />
        </div>
      </div>
      {aba === 'preview' && <AbaDePreview />}
    </div>
  );
}
