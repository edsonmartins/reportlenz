/**
 * `<ReportLenzPreview>` — render do engine de um template do REGISTRO com os
 * dados da aplicação, só leitura (ADR-025 §2). Sem `versao`, usa a versão
 * PUBLICADA mais recente.
 *
 * Usa os mesmos endpoints do designer (`GET /templates/…` e
 * `POST /render/preview`), portanto o mesmo papel no serviço
 * (`reportlenz-designer`). O payload é validado pelo serviço contra o
 * inputSchema da versão (422 com as violações).
 */
import { useEffect, useRef, useState } from 'react';
import { criarClienteDaApi } from './api/cliente';
import type { PropsDeConexao } from './ReportLenzDesigner';
import type { ZoomDoPreview } from './preview/previewStore';
import { VisualizadorDePagina } from './preview/AbaDePreview';

export interface ReportLenzPreviewProps extends PropsDeConexao {
  codename: string;
  /** Versão específica; ausente = a publicada mais recente. */
  versao?: number;
  /** Dados no formato do inputSchema do template (Push, contract-first). */
  payload: Record<string, unknown>;
  /** Zoom inicial. Default: ajustar à largura. */
  zoomInicial?: ZoomDoPreview;
  /** Conteúdo da aplicação na barra do preview (ex.: botão de download). */
  barra?: React.ReactNode;
}

interface Versao {
  jrxml: string;
  inputSchema: unknown;
}

interface ErroDoServico {
  mensagem?: string;
  violacoes?: string[];
}

export function ReportLenzPreview(props: ReportLenzPreviewProps) {
  const atuais = useRef(props);
  atuais.current = props;
  const [api] = useState(
    () => (caminho: string, init?: RequestInit) =>
      criarClienteDaApi({
        apiBaseUrl: atuais.current.apiBaseUrl,
        getAccessToken: () => atuais.current.getAccessToken?.(),
        onNaoAutorizado: () => atuais.current.onNaoAutorizado?.(),
      })(caminho, init),
  );

  const [versao, setVersao] = useState<Versao | null>(null);
  const [pagina, setPagina] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(0);
  const [zoom, setZoom] = useState<ZoomDoPreview>(props.zoomInicial ?? 'largura');
  const [imagemUrl, setImagemUrl] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [violacoes, setViolacoes] = useState<string[]>([]);

  // 1) Versão do registro (publicada mais recente, ou a pedida).
  useEffect(() => {
    let cancelado = false;
    setVersao(null);
    setErro(null);
    setCarregando(true);
    void (async () => {
      try {
        const codename = encodeURIComponent(props.codename);
        let numero = props.versao;
        if (numero === undefined) {
          const lista = await api(`/templates/${codename}`);
          if (!lista.ok) throw new Error(lista.status === 404 ? `template "${props.codename}" não existe no registro` : `HTTP ${lista.status} ao listar versões`);
          const publicadas = ((await lista.json()) as Array<{ version: number; status: string }>).filter((v) => v.status === 'published');
          if (publicadas.length === 0) throw new Error(`"${props.codename}" não tem versão publicada`);
          numero = Math.max(...publicadas.map((v) => v.version));
        }
        const detalhe = await api(`/templates/${codename}/versoes/${numero}`);
        if (!detalhe.ok) throw new Error(`HTTP ${detalhe.status} ao abrir a versão ${numero}`);
        if (!cancelado) setVersao((await detalhe.json()) as Versao);
      } catch (e) {
        if (!cancelado) {
          setErro(e instanceof Error ? e.message : String(e));
          setCarregando(false);
        }
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [api, props.codename, props.versao]);

  // 2) Render da página com o payload da aplicação.
  const payloadJson = JSON.stringify(props.payload);
  useEffect(() => {
    if (!versao) return;
    let cancelado = false;
    setCarregando(true);
    setErro(null);
    setViolacoes([]);
    void (async () => {
      try {
        const resposta = await api('/render/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jrxml: versao.jrxml, sampleData: JSON.parse(payloadJson) as unknown, inputSchema: versao.inputSchema, format: 'png', page: pagina }),
        });
        if (cancelado) return;
        if (!resposta.ok) {
          const corpo = (await resposta.json().catch(() => ({}))) as ErroDoServico;
          setErro(corpo.mensagem ?? `render falhou (HTTP ${resposta.status})`);
          setViolacoes(corpo.violacoes ?? []);
          return;
        }
        const url = URL.createObjectURL(await resposta.blob());
        setImagemUrl((anterior) => {
          if (anterior) URL.revokeObjectURL(anterior);
          return url;
        });
        setTotalPaginas(Number(resposta.headers.get('X-Total-Pages') ?? '1'));
      } catch (e) {
        if (!cancelado) setErro(`serviço de render indisponível: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [api, versao, payloadJson, pagina]);

  // Libera a última imagem ao desmontar.
  useEffect(() => () => setImagemUrl((u) => (u ? (URL.revokeObjectURL(u), null) : null)), []);

  return (
    <div className="reportlenz-preview" data-testid="reportlenz-preview" style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <VisualizadorDePagina
        testid="reportlenz-preview-pagina"
        carregando={carregando}
        erro={erro}
        violacoes={violacoes}
        imagemUrl={imagemUrl}
        totalPaginas={totalPaginas}
        pagina={pagina}
        zoom={zoom}
        onZoom={setZoom}
        onPagina={setPagina}
        barra={props.barra}
      />
    </div>
  );
}
