import { MantineProvider } from '@mantine/core';
import { REFERENCIA_DANFE, REFERENCIA_FATURA, REFERENCIA_FORMULARIO, serializeJrxml } from '@reportlenz/jrxml-core';
import type { ReportTemplate } from '@reportlenz/jrxml-core';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ReportLenzDesigner, ReportLenzPreview } from '../src/index';

/**
 * API pública do pacote (ADR-025, change componente-embutivel/2.3):
 * Scenarios "Modo registro", "Modo controlado", "Preview avulso" e "Token da aplicação".
 */

const BASE = 'https://relatorios.exemplo';

type Rota = (url: string, init: RequestInit) => Response | undefined;

function json(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
}

function png(totalPaginas = 1): Response {
  return new Response(new Blob(['png'], { type: 'image/png' }), { status: 200, headers: { 'X-Total-Pages': String(totalPaginas) } });
}

/** fetch simulado por rota; guarda as chamadas para conferência. */
function servico(...rotas: Rota[]) {
  const f = vi.fn((url: string, init: RequestInit = {}) => {
    for (const rota of rotas) {
      const r = rota(url, init);
      if (r) return Promise.resolve(r);
    }
    return Promise.resolve(json({ mensagem: `rota não simulada: ${url}` }, 404));
  });
  vi.stubGlobal('fetch', f);
  return f;
}

const registroDoFormulario: Rota = (url) => {
  if (url === `${BASE}/templates/cadastro`) return json([{ version: 1, status: 'published' }, { version: 2, status: 'draft' }]);
  if (url === `${BASE}/templates/cadastro/versoes/2`) return json({ codename: 'cadastro', version: 2, jrxml: serializeJrxml(REFERENCIA_FORMULARIO), inputSchema: {} });
  if (url === `${BASE}/templates/cadastro/versoes/1`) return json({ codename: 'cadastro', version: 1, jrxml: serializeJrxml(REFERENCIA_FORMULARIO), inputSchema: { $id: 'v1' } });
  return undefined;
};

const autorizacao = (f: ReturnType<typeof servico>, i: number) => new Headers(f.mock.calls[i]?.[1]?.headers).get('Authorization');

function comMantine(ui: React.ReactNode) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

afterEach(() => vi.unstubAllGlobals());

describe('@reportlenz/designer-react · <ReportLenzDesigner> modo registro', () => {
  it('abre a versão mais recente do codename com o token da aplicação em toda chamada', async () => {
    const f = servico(registroDoFormulario);
    comMantine(<ReportLenzDesigner apiBaseUrl={BASE} getAccessToken={() => 'tok-app'} codename="cadastro" />);

    await waitFor(() => expect(screen.getByTestId('nome-do-template')).toHaveTextContent('formulario_cadastro'));
    expect(f.mock.calls.map((c) => c[0])).toEqual([`${BASE}/templates/cadastro`, `${BASE}/templates/cadastro/versoes/2`]);
    expect(autorizacao(f, 0)).toBe('Bearer tok-app');
    expect(autorizacao(f, 1)).toBe('Bearer tok-app');
    expect(screen.queryByTestId('galeria')).not.toBeInTheDocument();
  });

  it('Salvar grava sob o codename do registro e chama onSalvo', async () => {
    const f = servico(registroDoFormulario, (url, init) =>
      url === `${BASE}/templates/cadastro/versoes` && init.method === 'POST' ? json({ version: 3, novaVersao: true, jrxmlHash: 'abc' }) : undefined,
    );
    const onSalvo = vi.fn();
    comMantine(<ReportLenzDesigner apiBaseUrl={BASE} getAccessToken={() => 'tok'} codename="cadastro" versao={1} onSalvo={onSalvo} />);
    await waitFor(() => expect(screen.getByTestId('salvar')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('salvar'));

    await waitFor(() => expect(onSalvo).toHaveBeenCalledWith({ codename: 'cadastro', versao: 3, novaVersao: true, jrxmlHash: 'abc' }));
    expect(screen.getByTestId('estado-do-salvamento')).toHaveTextContent('salvo · v3');
    const corpo = JSON.parse(f.mock.calls.at(-1)![1]!.body as string) as { jrxml: string };
    expect(corpo.jrxml).toContain('<jasperReport name="formulario_cadastro"');
  });

  it('codename inexistente mostra o erro (sem tela branca)', async () => {
    servico();
    comMantine(<ReportLenzDesigner apiBaseUrl={BASE} codename="fantasma" />);
    await waitFor(() => expect(screen.getByTestId('designer-erro')).toHaveTextContent('"fantasma" não existe no registro'));
  });

  it('sem codename mostra a galeria; recursos.galeria=false mostra o estado vazio', () => {
    const { unmount } = comMantine(<ReportLenzDesigner />);
    expect(screen.getByTestId('galeria')).toBeInTheDocument();
    unmount();
    comMantine(<ReportLenzDesigner recursos={{ galeria: false }} />);
    expect(screen.getByTestId('sem-documento')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Novo template em branco' }));
    expect(screen.getByTestId('nome-do-template')).toHaveTextContent('novo_relatorio');
  });

  it('acoesExtras da aplicação aparecem na barra', () => {
    comMantine(<ReportLenzDesigner template={REFERENCIA_FATURA} onChange={() => {}} acoesExtras={<button>Ajuda da empresa</button>} />);
    expect(screen.getByRole('button', { name: 'Ajuda da empresa' })).toBeInTheDocument();
  });
});

describe('@reportlenz/designer-react · <ReportLenzDesigner> modo controlado', () => {
  function Hospedeiro({ aoMudar }: { aoMudar: (t: ReportTemplate, jrxml: string) => void }) {
    const [template, setTemplate] = useState<ReportTemplate | string>(serializeJrxml(REFERENCIA_FATURA));
    return (
      <ReportLenzDesigner
        template={template}
        onChange={(t, jrxml) => {
          aoMudar(t, jrxml);
          setTemplate(t); // eco: a aplicação devolve o que recebeu
        }}
      />
    );
  }

  it('abre o JRXML recebido, emite onChange a cada edição e o eco da prop não recarrega o documento', async () => {
    const aoMudar = vi.fn();
    comMantine(<Hospedeiro aoMudar={aoMudar} />);
    expect(screen.getByTestId('nome-do-template')).toHaveTextContent('fatura_completa');
    expect(aoMudar).not.toHaveBeenCalled(); // abrir não é mudança

    fireEvent.pointerDown(screen.getByTestId('canvas'));
    fireEvent.pointerDown(screen.getByTestId('el-title/0'), { pointerId: 1 });
    fireEvent.pointerUp(screen.getByTestId('el-title/0'), { pointerId: 1 });
    fireEvent.keyDown(window, { key: 'ArrowRight' });

    await waitFor(() => expect(aoMudar).toHaveBeenCalled());
    const [modelo, jrxml] = aoMudar.mock.calls.at(-1)! as [ReportTemplate, string];
    expect(modelo.bands.title!.elements[0]!.bounds.x).toBe(REFERENCIA_FATURA.bands.title!.elements[0]!.bounds.x + 1);
    expect(jrxml).toContain('<jasperReport name="fatura_completa"');
    // Eco não recarregou: o histórico de undo continua lá.
    expect(screen.getByRole('button', { name: 'desfazer' })).toBeEnabled();
  });

  it('esconde Salvar/Publicar por padrão (a aplicação persiste) e não chama o registro', () => {
    const f = servico();
    comMantine(<ReportLenzDesigner template={REFERENCIA_DANFE} onChange={() => {}} />);
    expect(screen.queryByTestId('salvar')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Publicar…' })).not.toBeInTheDocument();
    expect(f).not.toHaveBeenCalled();
  });

  it('JRXML inválido vira mensagem', () => {
    comMantine(<ReportLenzDesigner template={'<jasperReport name="x"><query language="sql"><![CDATA[SELECT 1]]></query></jasperReport>'} onChange={() => {}} />);
    expect(screen.getByTestId('designer-erro')).toHaveTextContent('JRXML inválido');
  });

  it('Scenario "Duas instâncias na mesma página": editar uma não altera a outra', async () => {
    const a = vi.fn();
    const b = vi.fn();
    comMantine(
      <>
        <div data-testid="a">
          <ReportLenzDesigner template={REFERENCIA_FATURA} onChange={a} />
        </div>
        <div data-testid="b">
          <ReportLenzDesigner template={REFERENCIA_DANFE} onChange={b} />
        </div>
      </>,
    );
    const A = within(screen.getByTestId('a'));
    fireEvent.pointerDown(A.getByTestId('canvas'));
    fireEvent.pointerDown(A.getByTestId('el-title/0'), { pointerId: 1 });
    fireEvent.pointerUp(A.getByTestId('el-title/0'), { pointerId: 1 });
    fireEvent.keyDown(window, { key: 'ArrowDown' });

    await waitFor(() => expect(a).toHaveBeenCalled());
    expect(b).not.toHaveBeenCalled();
    expect(within(screen.getByTestId('b')).getByTestId('nome-do-template')).toHaveTextContent('danfe_retrato');
  });
});

describe('@reportlenz/designer-react · <ReportLenzPreview>', () => {
  it('renderiza a versão PUBLICADA mais recente com o payload da aplicação', async () => {
    const f = servico(registroDoFormulario, (url) => (url === `${BASE}/render/preview` ? png(2) : undefined));
    comMantine(<ReportLenzPreview apiBaseUrl={BASE} getAccessToken={() => 'tok'} codename="cadastro" payload={{ nome: 'Maria' }} />);

    await waitFor(() => expect(screen.getByTestId('preview-img')).toBeInTheDocument());
    expect(screen.getByTestId('preview-paginacao')).toHaveTextContent('1 / 2');
    // v2 é draft → usa a v1 publicada.
    expect(f.mock.calls.map((c) => c[0])).toContain(`${BASE}/templates/cadastro/versoes/1`);
    const render = f.mock.calls.find((c) => c[0] === `${BASE}/render/preview`)!;
    expect(JSON.parse(render[1]!.body as string)).toMatchObject({ sampleData: { nome: 'Maria' }, inputSchema: { $id: 'v1' }, page: 0 });
    expect(new Headers(render[1]!.headers).get('Authorization')).toBe('Bearer tok');

    fireEvent.click(screen.getByRole('button', { name: 'próxima página' }));
    await waitFor(() => expect(screen.getByTestId('preview-paginacao')).toHaveTextContent('2 / 2'));
  });

  it('payload fora do contrato mostra as violações do serviço', async () => {
    servico(registroDoFormulario, (url) =>
      url === `${BASE}/render/preview` ? json({ mensagem: 'payload não satisfaz o contrato', violacoes: ['$.nome: obrigatório'] }, 422) : undefined,
    );
    comMantine(<ReportLenzPreview apiBaseUrl={BASE} codename="cadastro" payload={{}} />);
    await waitFor(() => expect(screen.getByTestId('preview-erro')).toHaveTextContent('$.nome: obrigatório'));
  });

  it('template sem versão publicada é explicado', async () => {
    servico((url) => (url === `${BASE}/templates/rascunho` ? json([{ version: 1, status: 'draft' }]) : undefined));
    comMantine(<ReportLenzPreview apiBaseUrl={BASE} codename="rascunho" payload={{}} />);
    await waitFor(() => expect(screen.getByTestId('preview-erro')).toHaveTextContent('não tem versão publicada'));
  });
});
