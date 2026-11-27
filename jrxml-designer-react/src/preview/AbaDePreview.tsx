/**
 * Aba Preview (ADR-024, supersede o painel lateral da RFC-004 §7): o render
 * REAL do engine em tela cheia — a verdade (I-8). A aproximação continua no
 * canvas da aba Editor, rotulada.
 *
 * - zoom: ajustar à largura (padrão), página inteira ou 50–200%;
 * - desatualização: se o documento mudou desde o último render, avisa e
 *   renderiza de novo ao abrir a aba.
 */
import { ActionIcon, Alert, Badge, Button, Group, Loader, SegmentedControl, Select, Stack, Text, Tooltip } from '@mantine/core';
import { serializeJrxml } from '@archbase/reportlenz-jrxml-core';
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useDocumentoStore } from '../store/documentoStore';
import { usePreviewStore, type ZoomDoPreview } from './previewStore';

/** O PNG vem a 2× (144 dpi): 1pt do relatório = 2px da imagem; 100% = 1pt → 96/72 px CSS. */
const PX_DA_IMAGEM_POR_PT = 2;
const PX_CSS_POR_PT = 96 / 72;
const PERCENTUAIS = ['50', '75', '100', '125', '150', '200'];

function estiloDaPagina(zoom: ZoomDoPreview, larguraNatural: number | null): CSSProperties {
  const base: CSSProperties = { display: 'block', background: '#fff', boxShadow: '0 2px 10px rgba(0,0,0,0.25)' };
  if (zoom === 'largura') return { ...base, width: '100%', height: 'auto' };
  if (zoom === 'pagina') return { ...base, height: '100%', width: 'auto', maxWidth: '100%', objectFit: 'contain' };
  if (larguraNatural === null) return { ...base, width: '100%' };
  return { ...base, width: (larguraNatural / PX_DA_IMAGEM_POR_PT) * PX_CSS_POR_PT * zoom, maxWidth: 'none' };
}

export interface VisualizadorDePaginaProps {
  testid: string;
  carregando: boolean;
  erro: string | null;
  violacoes: string[];
  imagemUrl: string | null;
  totalPaginas: number;
  pagina: number;
  zoom: ZoomDoPreview;
  onZoom: (zoom: ZoomDoPreview) => void;
  onPagina: (pagina: number) => void;
  /** Conteúdo da aplicação à esquerda da paginação (título, selos, botões). */
  barra?: ReactNode;
}

/**
 * Página renderizada pelo engine com zoom e paginação — sem saber de onde
 * veio o JRXML. Usado pela aba Preview do designer e pelo
 * `<ReportLenzPreview>` (ADR-025).
 */
export function VisualizadorDePagina(props: VisualizadorDePaginaProps) {
  const { testid, carregando, erro, violacoes, imagemUrl, totalPaginas, pagina, zoom, onZoom, onPagina, barra } = props;
  const [larguraNatural, setLarguraNatural] = useState<number | null>(null);
  const valorDoZoom = typeof zoom === 'number' ? 'percentual' : zoom;

  return (
    <div data-testid={testid} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Group gap="xs" px="md" py={6} style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}>
        {barra}
        {totalPaginas > 1 && (
          <Group gap={4}>
            <ActionIcon size="sm" variant="subtle" aria-label="página anterior" disabled={pagina <= 0 || carregando} onClick={() => onPagina(pagina - 1)}>
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
              onClick={() => onPagina(pagina + 1)}
            >
              ›
            </ActionIcon>
          </Group>
        )}
        <Group gap={6} ml="auto">
          <SegmentedControl
            size="xs"
            aria-label="zoom do preview"
            value={valorDoZoom}
            onChange={(v) => onZoom(v === 'percentual' ? 1 : v)}
            data={[
              { value: 'largura', label: 'Ajustar à largura' },
              { value: 'pagina', label: 'Página inteira' },
              { value: 'percentual', label: '%' },
            ]}
          />
          {typeof zoom === 'number' && (
            <Select
              size="xs"
              w={88}
              aria-label="percentual do zoom"
              data={PERCENTUAIS.map((p) => ({ value: p, label: `${p}%` }))}
              value={String(Math.round(zoom * 100))}
              onChange={(v) => v && onZoom(Number(v) / 100)}
              allowDeselect={false}
            />
          )}
        </Group>
      </Group>

      <div
        data-testid="preview-area"
        style={{
          flex: 1,
          minHeight: 0,
          overflow: zoom === 'pagina' ? 'hidden' : 'auto',
          background: 'var(--mantine-color-gray-2)',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {carregando && (
          <Group gap="xs" mb="sm">
            <Loader size="xs" />
            <Text size="xs" c="dimmed">
              renderizando no engine…
            </Text>
          </Group>
        )}
        {erro && (
          <Alert color="red" title="Render recusado" data-testid="preview-erro" maw={720} w="100%">
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
        {imagemUrl && !erro && (
          <img
            data-testid="preview-img"
            src={imagemUrl}
            alt={`render Jasper — página ${pagina + 1}`}
            onLoad={(e) => setLarguraNatural(e.currentTarget.naturalWidth || null)}
            style={{ ...estiloDaPagina(zoom, larguraNatural), opacity: carregando ? 0.5 : 1, flexShrink: 0 }}
          />
        )}
      </div>
    </div>
  );
}

export function AbaDePreview() {
  const template = useDocumentoStore((s) => s.template);
  const carregando = usePreviewStore((s) => s.carregando);
  const erro = usePreviewStore((s) => s.erro);
  const violacoes = usePreviewStore((s) => s.violacoes);
  const imagemUrl = usePreviewStore((s) => s.imagemUrl);
  const totalPaginas = usePreviewStore((s) => s.totalPaginas);
  const pagina = usePreviewStore((s) => s.pagina);
  const zoom = usePreviewStore((s) => s.zoom);
  const jrxmlRenderizado = usePreviewStore((s) => s.jrxmlRenderizado);
  const definirZoom = usePreviewStore((s) => s.definirZoom);
  const renderizar = usePreviewStore((s) => s.renderizar);

  const jrxmlAtual = useMemo(() => (template ? serializeJrxml(template) : null), [template]);
  const desatualizado = jrxmlAtual !== null && jrxmlAtual !== jrxmlRenderizado;

  // Abriu a aba com o documento diferente do último render → renderiza de novo
  // (o usuário nunca olha um render que não corresponde ao que edita).
  useEffect(() => {
    if (desatualizado && !carregando) void renderizar(jrxmlRenderizado === null ? 0 : Math.min(pagina, Math.max(totalPaginas - 1, 0)));
    // Dependência só em `desatualizado`: dispara quando o documento diverge do render.
  }, [desatualizado]);

  return (
    <VisualizadorDePagina
      testid="aba-preview"
      carregando={carregando}
      erro={erro}
      violacoes={violacoes}
      imagemUrl={imagemUrl}
      totalPaginas={totalPaginas}
      pagina={pagina}
      zoom={zoom}
      onZoom={definirZoom}
      onPagina={(p) => void renderizar(p)}
      barra={
        <>
          <Text size="sm" fw={600}>
            Render Jasper
          </Text>
          <Tooltip label="Isto é o que o engine produz em produção; o canvas da aba Editor é aproximação (I-8)">
            <Badge size="xs" color="green" variant="light">
              verdade do engine
            </Badge>
          </Tooltip>
          {desatualizado && !carregando && (
            <Badge size="xs" color="yellow" variant="light" data-testid="preview-desatualizado">
              desatualizado
            </Badge>
          )}
          <Button size="compact-xs" variant="light" onClick={() => void renderizar(pagina)} disabled={carregando}>
            Renderizar novamente
          </Button>
        </>
      }
    />
  );
}
