/**
 * `<ReportLenzDesigner>` — o designer como componente embutível (ADR-025).
 *
 * Cada instância tem o próprio estado (documento, seleção, abas, preview) e
 * fala com o render-service pelo `apiBaseUrl`, com o token que a aplicação
 * fornece a cada chamada. Precisa estar dentro do `MantineProvider` da
 * aplicação (Mantine é peerDependency) e ocupa 100% do contêiner.
 *
 * Dois modos, inferidos das props:
 * - **registro** (default): `codename`/`versao` abrem do registro; Salvar e
 *   Publicar gravam lá (`onSalvo`, `onPublicado`). Sem `codename` = galeria.
 * - **controlado**: `template` + `onChange` — a aplicação guarda o template.
 */
import { Alert, Group, Loader, Text } from '@mantine/core';
import type { ReportTemplate } from '@reportlenz/jrxml-core';
import { parseJrxml, serializeJrxml } from '@reportlenz/jrxml-core';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { criarClienteDaApi, type ObterToken } from './api/cliente';
import { AreaDeTrabalho } from './designer/AreaDeTrabalho';
import { ProvedorDeIntegracao, type EventoPublicado, type EventoSalvo, type Integracao, type Recursos } from './designer/integracao';
import { criarInstanciaDoDesigner, ProvedorDeInstancia } from './instancia';

export interface PropsDeConexao {
  /** Base do render-service. Default: mesma origem (proxy da aplicação). */
  apiBaseUrl?: string;
  /** Token Bearer pedido a CADA chamada; o componente nunca o guarda. */
  getAccessToken?: ObterToken;
  /** O serviço respondeu 401 (token expirado/inválido). */
  onNaoAutorizado?: () => void;
}

interface PropsComuns extends PropsDeConexao {
  /** Liga/desliga partes da interface. Defaults dependem do modo. */
  recursos?: Partial<Recursos>;
  /** Ações da aplicação à direita da barra do designer. */
  acoesExtras?: ReactNode;
}

export interface PropsDoModoRegistro extends PropsComuns {
  /** Template do registro a abrir; ausente = galeria de modelos. */
  codename?: string;
  /** Versão a abrir; ausente = a mais recente. */
  versao?: number;
  onSalvo?: (evento: EventoSalvo) => void;
  onPublicado?: (evento: EventoPublicado) => void;
  template?: never;
  onChange?: never;
}

export interface PropsDoModoControlado extends PropsComuns {
  /** Template a editar: modelo do jrxml-core ou JRXML 7. */
  template: ReportTemplate | string;
  /** Chamado a cada mudança, com o modelo e o JRXML serializado. */
  onChange: (template: ReportTemplate, jrxml: string) => void;
  /** Só faz sentido com recursos.publicar=true: publica no registro sob este codename. */
  codename?: string;
  onPublicado?: (evento: EventoPublicado) => void;
  versao?: never;
  onSalvo?: never;
}

export type ReportLenzDesignerProps = PropsDoModoRegistro | PropsDoModoControlado;

function paraModelo(template: ReportTemplate | string): ReportTemplate {
  if (typeof template !== 'string') return template;
  const r = parseJrxml(template);
  if (!r.ok) throw new Error(`JRXML inválido: ${r.errors.map((e) => e.message).join('; ')}`);
  return r.value;
}

export function ReportLenzDesigner(props: ReportLenzDesignerProps) {
  // Props mais recentes sem recriar a instância (token, callbacks, base da API).
  const atuais = useRef(props);
  atuais.current = props;

  const [instancia] = useState(() =>
    criarInstanciaDoDesigner({
      api: (caminho, init) =>
        criarClienteDaApi({
          apiBaseUrl: atuais.current.apiBaseUrl,
          getAccessToken: () => atuais.current.getAccessToken?.(),
          onNaoAutorizado: () => atuais.current.onNaoAutorizado?.(),
        })(caminho, init),
    }),
  );

  const controlado = props.template !== undefined;
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (import.meta.env?.DEV && controlado && props.versao !== undefined) {
    console.error('[ReportLenzDesigner] `template` (modo controlado) e `versao` (modo registro) não combinam — use um modo.');
  }

  // --- Modo controlado: prop → documento (só quando muda DE FORA) e documento → onChange.
  const ultimoEmitido = useRef<{ modelo: ReportTemplate | null; jrxml: string | null }>({ modelo: null, jrxml: null });
  const carregandoDaProp = useRef(false);

  useEffect(() => {
    if (!controlado || props.template === undefined) return;
    const recebido = props.template;
    const ultimo = ultimoEmitido.current;
    if (recebido === ultimo.modelo || (typeof recebido === 'string' && recebido === ultimo.jrxml)) return;
    try {
      const modelo = paraModelo(recebido);
      carregandoDaProp.current = true;
      instancia.documento.getState().novoDocumento(modelo);
      carregandoDaProp.current = false;
      setErro(null);
    } catch (e) {
      carregandoDaProp.current = false;
      setErro(e instanceof Error ? e.message : String(e));
    }
  }, [controlado, props.template, instancia]);

  useEffect(() => {
    if (!controlado) return;
    return instancia.documento.subscribe((estado, anterior) => {
      if (carregandoDaProp.current || !estado.template || estado.template === anterior.template) return;
      const jrxml = serializeJrxml(estado.template);
      ultimoEmitido.current = { modelo: estado.template, jrxml };
      (atuais.current as PropsDoModoControlado).onChange(estado.template, jrxml);
    });
  }, [controlado, instancia]);

  // --- Modo registro: codename/versão → documento.
  const codename = props.codename;
  const versao = controlado ? undefined : props.versao;
  useEffect(() => {
    if (controlado || !codename) return;
    let cancelado = false;
    setCarregando(true);
    setErro(null);
    void (async () => {
      try {
        let numero = versao;
        if (numero === undefined) {
          const lista = await instancia.api(`/templates/${encodeURIComponent(codename)}`);
          if (!lista.ok) throw new Error(lista.status === 404 ? `template "${codename}" não existe no registro` : `HTTP ${lista.status} ao listar versões`);
          const versoes = (await lista.json()) as Array<{ version: number }>;
          numero = Math.max(...versoes.map((v) => v.version));
        }
        const detalhe = await instancia.api(`/templates/${encodeURIComponent(codename)}/versoes/${numero}`);
        if (!detalhe.ok) throw new Error(detalhe.status === 404 ? `versão ${numero} de "${codename}" não existe` : `HTTP ${detalhe.status} ao abrir a versão`);
        const { jrxml } = (await detalhe.json()) as { jrxml: string };
        if (cancelado) return;
        instancia.preview.getState().reiniciar();
        instancia.documento.getState().novoDocumento(paraModelo(jrxml));
      } catch (e) {
        if (!cancelado) setErro(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [controlado, codename, versao, instancia]);

  const integracao = useMemo<Integracao>(
    () => ({
      codename,
      recursos: {
        galeria: !controlado && !codename,
        assistente: true,
        salvar: !controlado,
        publicar: !controlado,
        ...props.recursos,
      },
      acoesExtras: props.acoesExtras,
      baixarPacoteDeIntegracao: false,
      onSalvo: (e) => (atuais.current as PropsDoModoRegistro).onSalvo?.(e),
      onPublicado: (e) => atuais.current.onPublicado?.(e),
    }),
    [codename, controlado, props.recursos, props.acoesExtras],
  );

  return (
    <ProvedorDeInstancia instancia={instancia}>
      <ProvedorDeIntegracao valor={integracao}>
        <div className="reportlenz-designer" data-testid="reportlenz-designer" style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {erro && (
            <Alert color="red" title="Não foi possível abrir o template" m="xs" data-testid="designer-erro">
              {erro}
            </Alert>
          )}
          {carregando ? (
            <Group gap="xs" p="md">
              <Loader size="xs" />
              <Text size="sm" c="dimmed">
                abrindo {codename}…
              </Text>
            </Group>
          ) : (
            <AreaDeTrabalho />
          )}
        </div>
      </ProvedorDeIntegracao>
    </ProvedorDeInstancia>
  );
}
