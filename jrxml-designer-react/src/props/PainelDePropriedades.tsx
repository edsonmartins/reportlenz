/**
 * Painel de propriedades (RFC-004 §4, tarefas phase-2/3.1-3.3).
 *
 * - 3.1: atributos JR do elemento selecionado (bounds, aparência, específicos
 *   por kind, styleRef, printWhenExpression);
 * - 3.2: HERANÇA VISUAL — valor herdado/calculado em cinza-claro, sobrescrito
 *   em preto; o × remove a sobrescrita e volta a herdar (padrão Jaspersoft);
 * - 3.3: filtro de propriedades por nome.
 */
import {
  ActionIcon,
  Checkbox,
  Divider,
  Group,
  NumberInput,
  ScrollArea,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import type { Element, StyleProps } from '@reportlenz/jrxml-core';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { ExpressionEditor } from '../expression/ExpressionEditor';
import { EditorDeTabela } from './EditorDeTabela';
import { escopoMaster } from '../expression/sugestoes';
import { useDocumentoStore, obterBanda } from '../store/documentoStore';
import { atualizarBoundsDoElemento, comElemento, definirEstiloDoElemento } from '../store/mutacoes';
import { resolverPropDeEstilo } from './heranca';

const LARGURA_DO_PAINEL = 300;

function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Linha de propriedade com a marcação de herança (3.2). */
function Linha({
  id,
  rotulo,
  herdado,
  origem,
  onLimpar,
  children,
}: {
  id: string;
  rotulo: string;
  herdado?: boolean;
  origem?: string;
  onLimpar?: () => void;
  children: ReactNode;
}) {
  return (
    <Group gap={6} wrap="nowrap" data-testid={`prop-${id}`} data-herdado={herdado || undefined}>
      <Text size="xs" w={92} style={{ flexShrink: 0 }} c={herdado ? 'gray.5' : 'dark.9'} title={origem}>
        {rotulo}
      </Text>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      {herdado === false && onLimpar && (
        <Tooltip label="Remover sobrescrita (voltar a herdar)">
          <ActionIcon size="xs" variant="subtle" aria-label={`limpar ${rotulo}`} onClick={onLimpar}>
            ×
          </ActionIcon>
        </Tooltip>
      )}
    </Group>
  );
}

/** Texto com commit no blur/Enter (não polui o histórico a cada tecla). */
function CampoTexto({
  valor,
  herdado,
  onCommit,
  ...props
}: {
  valor: string;
  herdado?: boolean;
  onCommit: (v: string) => void;
  placeholder?: string;
  'aria-label'?: string;
}) {
  const [local, setLocal] = useState(valor);
  useEffect(() => {
    setLocal(valor);
  }, [valor]);
  return (
    <TextInput
      size="xs"
      value={local}
      onChange={(e) => setLocal(e.currentTarget.value)}
      onBlur={() => local !== valor && onCommit(local)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
      styles={herdado ? { input: { color: 'var(--mantine-color-gray-5)' } } : undefined}
      {...props}
    />
  );
}

export function PainelDePropriedades() {
  const template = useDocumentoStore((s) => s.template);
  const selecao = useDocumentoStore((s) => s.selecao);
  const mutarTemplate = useDocumentoStore((s) => s.mutarTemplate);
  const [filtro, setFiltro] = useState('');

  if (!template) return null;

  const moldura = (conteudo: ReactNode) => (
    <aside
      data-testid="painel-propriedades"
      style={{
        width: LARGURA_DO_PAINEL,
        borderLeft: '1px solid var(--mantine-color-gray-3)',
        background: 'var(--mantine-color-gray-0)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      {conteudo}
    </aside>
  );

  if (selecao.length !== 1) {
    return moldura(
      <Text size="sm" c="dimmed" p="md">
        {selecao.length === 0 ? 'Selecione um elemento no canvas.' : `${selecao.length} elementos selecionados.`}
      </Text>,
    );
  }

  const caminho = selecao[0]!;
  const banda = obterBanda(template, caminho.banda);
  const elemento = banda?.elements[caminho.indice];
  if (!elemento) return moldura(null);

  const b = elemento.bounds;
  const mudarBounds = (patch: Partial<typeof b>) =>
    mutarTemplate(atualizarBoundsDoElemento(caminho, { ...b, ...patch }));

  const mudarElemento = (atualizar: (el: Element) => Element) =>
    mutarTemplate((t) => comElemento(t, caminho, atualizar));

  const estilo =
    <K extends keyof StyleProps>(prop: K, rotulo: string, controle: (r: ReturnType<typeof resolverPropDeEstilo<K>>) => ReactNode) => {
      const r = resolverPropDeEstilo(template, elemento, prop);
      const herdado = r.origem !== 'local';
      return {
        id: String(prop),
        rotulo,
        no: (
          <Linha
            key={String(prop)}
            id={String(prop)}
            rotulo={rotulo}
            herdado={herdado}
            origem={r.origem === 'local' ? 'sobrescrito' : `herdado (${r.estilo ?? 'engine'})`}
            onLimpar={() => mutarTemplate(definirEstiloDoElemento(caminho, prop, undefined))}
          >
            {controle(r)}
          </Linha>
        ),
      };
    };

  const defEstilo = <K extends keyof StyleProps>(prop: K, valor: StyleProps[K] | undefined) =>
    mutarTemplate(definirEstiloDoElemento(caminho, prop, valor));

  const numero = (id: string, rotulo: string, valor: number, onChange: (v: number) => void) => ({
    id,
    rotulo,
    no: (
      <Linha key={id} id={id} rotulo={rotulo}>
        <NumberInput size="xs" value={valor} aria-label={rotulo} onChange={(v) => typeof v === 'number' && onChange(v)} />
      </Linha>
    ),
  });

  const texto = (id: string, rotulo: string, valor: string, onCommit: (v: string) => void) => ({
    id,
    rotulo,
    no: (
      <Linha key={id} id={id} rotulo={rotulo}>
        <CampoTexto valor={valor} onCommit={onCommit} aria-label={rotulo} />
      </Linha>
    ),
  });

  // Expression editor (phase-3/1.x): autocomplete sobre o contrato + inline.
  const escopo = escopoMaster(template.dataContract, template.bands.groups.map((g) => g.name));
  const expressao = (id: string, rotulo: string, valor: string, onCommit: (v: string) => void) => ({
    id,
    rotulo,
    no: (
      <Linha key={id} id={id} rotulo={rotulo}>
        <ExpressionEditor valor={valor} escopo={escopo} onCommit={onCommit} aria-label={rotulo} />
      </Linha>
    ),
  });

  const linhas: Array<{ id: string; rotulo: string; no: ReactNode }> = [
    // ---- posição e tamanho (sempre locais)
    numero('x', 'X (pt)', b.x, (v) => mudarBounds({ x: v })),
    numero('y', 'Y (pt)', b.y, (v) => mudarBounds({ y: v })),
    numero('width', 'Largura (pt)', b.width, (v) => mudarBounds({ width: v })),
    numero('height', 'Altura (pt)', b.height, (v) => mudarBounds({ height: v })),

    // ---- estilo com herança visual (3.2)
    {
      id: 'styleRef',
      rotulo: 'Estilo',
      no: (
        <Linha key="styleRef" id="styleRef" rotulo="Estilo">
          <Select
            size="xs"
            aria-label="Estilo"
            data={[{ value: '', label: '(nenhum)' }, ...template.styles.map((s) => ({ value: s.name, label: s.name }))]}
            value={elemento.styleRef ?? ''}
            onChange={(v) =>
              mudarElemento((el) => {
                if (!v) {
                  const copia = { ...el };
                  delete copia.styleRef;
                  return copia;
                }
                return { ...el, styleRef: v };
              })
            }
          />
        </Linha>
      ),
    },
    estilo('fontName', 'Fonte', (r) => (
      <CampoTexto valor={r.valor ?? ''} herdado={r.origem !== 'local'} onCommit={(v) => defEstilo('fontName', v || undefined)} aria-label="Fonte" />
    )),
    estilo('fontSize', 'Tamanho fonte', (r) => (
      <NumberInput
        size="xs"
        aria-label="Tamanho fonte"
        value={r.valor ?? ''}
        onChange={(v) => defEstilo('fontSize', typeof v === 'number' ? v : undefined)}
        styles={r.origem !== 'local' ? { input: { color: 'var(--mantine-color-gray-5)' } } : undefined}
      />
    )),
    estilo('bold', 'Negrito', (r) => (
      <Checkbox size="xs" aria-label="Negrito" checked={r.valor ?? false} onChange={(e) => defEstilo('bold', e.currentTarget.checked)} />
    )),
    estilo('italic', 'Itálico', (r) => (
      <Checkbox size="xs" aria-label="Itálico" checked={r.valor ?? false} onChange={(e) => defEstilo('italic', e.currentTarget.checked)} />
    )),
    estilo('hAlign', 'Alinh. horizontal', (r) => (
      <Select
        size="xs"
        aria-label="Alinh. horizontal"
        data={['Left', 'Center', 'Right', 'Justified']}
        value={r.valor ?? null}
        onChange={(v) => defEstilo('hAlign', (v as StyleProps['hAlign']) ?? undefined)}
        clearable
      />
    )),
    estilo('vAlign', 'Alinh. vertical', (r) => (
      <Select
        size="xs"
        aria-label="Alinh. vertical"
        data={['Top', 'Middle', 'Bottom']}
        value={r.valor ?? null}
        onChange={(v) => defEstilo('vAlign', (v as StyleProps['vAlign']) ?? undefined)}
        clearable
      />
    )),
    estilo('forecolor', 'Cor do texto', (r) => (
      <CampoTexto valor={r.valor ?? ''} herdado={r.origem !== 'local'} onCommit={(v) => defEstilo('forecolor', v || undefined)} placeholder="#000000" aria-label="Cor do texto" />
    )),
    estilo('backcolor', 'Cor de fundo', (r) => (
      <CampoTexto valor={r.valor ?? ''} herdado={r.origem !== 'local'} onCommit={(v) => defEstilo('backcolor', v || undefined)} placeholder="#FFFFFF" aria-label="Cor de fundo" />
    )),

    // ---- comum
    expressao('printWhen', 'Imprimir quando', elemento.printWhenExpression ?? '', (v) =>
      mudarElemento((el) => {
        if (!v) {
          const copia = { ...el };
          delete copia.printWhenExpression;
          return copia;
        }
        return { ...el, printWhenExpression: v };
      }),
    ),
  ];

  // ---- específicos por kind (3.1)
  switch (elemento.kind) {
    case 'staticText':
      linhas.push(texto('text', 'Texto', elemento.text, (v) => mudarElemento((el) => ({ ...el, text: v }) as Element)));
      break;
    case 'textField':
      linhas.push(
        expressao('expression', 'Expressão', elemento.expression, (v) => mudarElemento((el) => ({ ...el, expression: v }) as Element)),
        texto('pattern', 'Padrão (pattern)', elemento.pattern ?? '', (v) =>
          mudarElemento((el) => {
            const tf = el as Extract<Element, { kind: 'textField' }>;
            if (!v) {
              const copia = { ...tf };
              delete copia.pattern;
              return copia;
            }
            return { ...tf, pattern: v };
          }),
        ),
        {
          id: 'blankWhenNull',
          rotulo: 'Vazio se nulo',
          no: (
            <Linha key="blankWhenNull" id="blankWhenNull" rotulo="Vazio se nulo">
              <Checkbox
                size="xs"
                aria-label="Vazio se nulo"
                checked={elemento.blankWhenNull ?? false}
                onChange={(e) => mudarElemento((el) => ({ ...el, blankWhenNull: e.currentTarget.checked }) as Element)}
              />
            </Linha>
          ),
        },
      );
      break;
    case 'image':
      linhas.push(
        expressao('expression', 'Expressão', elemento.expression, (v) => mudarElemento((el) => ({ ...el, expression: v }) as Element)),
        {
          id: 'scaleImage',
          rotulo: 'Escala',
          no: (
            <Linha key="scaleImage" id="scaleImage" rotulo="Escala">
              <Select
                size="xs"
                aria-label="Escala"
                data={['Clip', 'FillFrame', 'RetainShape', 'RealHeight', 'RealSize']}
                value={elemento.scaleImage ?? null}
                onChange={(v) => mudarElemento((el) => ({ ...el, scaleImage: v ?? undefined }) as Element)}
                clearable
              />
            </Linha>
          ),
        },
      );
      break;
    case 'barcode':
      linhas.push(
        {
          id: 'barcodeType',
          rotulo: 'Tipo de barcode',
          no: (
            <Linha key="barcodeType" id="barcodeType" rotulo="Tipo de barcode">
              <Select
                size="xs"
                aria-label="Tipo de barcode"
                data={['Code128', 'Code39', 'EAN13', 'EAN8', 'Interleaved2Of5', 'QRCode', 'DataMatrix', 'PDF417']}
                value={elemento.barcodeType}
                onChange={(v) => v && mudarElemento((el) => ({ ...el, barcodeType: v }) as Element)}
              />
            </Linha>
          ),
        },
        expressao('expression', 'Expressão', elemento.expression, (v) => mudarElemento((el) => ({ ...el, expression: v }) as Element)),
      );
      break;
    case 'rectangle':
      linhas.push(numero('radius', 'Raio (pt)', elemento.radius ?? 0, (v) => mudarElemento((el) => ({ ...el, radius: v }) as Element)));
      break;
    case 'subreport':
      linhas.push(
        expressao('templateExpression', 'Template', elemento.templateExpression, (v) =>
          mudarElemento((el) => ({ ...el, templateExpression: v }) as Element),
        ),
        expressao('dataSourceExpression', 'Datasource', elemento.dataSourceExpression ?? '', (v) =>
          mudarElemento((el) => ({ ...el, dataSourceExpression: v || undefined }) as Element),
        ),
      );
      break;
    case 'table':
      linhas.push({
        id: 'tabela',
        rotulo: 'Tabela',
        no: <EditorDeTabela key="tabela" caminho={caminho} tabela={elemento} />,
      });
      break;
    case 'line':
    case 'ellipse':
    case 'frame':
      break;
  }

  const filtroNorm = normalizar(filtro);
  const visiveis = filtroNorm ? linhas.filter((l) => normalizar(l.rotulo).includes(filtroNorm)) : linhas;

  return moldura(
    <>
      <Stack gap={4} p="sm" pb={4}>
        <Text size="sm" fw={600}>
          {elemento.kind}
        </Text>
        <TextInput
          size="xs"
          placeholder="Filtrar propriedades…"
          aria-label="filtrar propriedades"
          value={filtro}
          onChange={(e) => setFiltro(e.currentTarget.value)}
        />
        <Divider />
      </Stack>
      <ScrollArea style={{ flex: 1 }} px="sm" pb="sm">
        <Stack gap={6}>{visiveis.map((l) => l.no)}</Stack>
      </ScrollArea>
    </>,
  );
}
