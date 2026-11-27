/**
 * Galeria de templates iniciais pt-BR (ADR-005/RFC-004 §9, tarefa phase-2/7.2):
 * o "novo template" começa de um modelo pronto (ou em branco) — nunca de uma
 * tela intimidadora. Os modelos são os templates de referência do jrxml-core
 * (os mesmos validados pelo harness na Library real).
 */
import { Badge, Button, Card, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import type { ReportTemplate } from '@archbase/reportlenz-jrxml-core';
import { REFERENCE_TEMPLATES } from '@archbase/reportlenz-jrxml-core';
import { useInstancia } from '../instancia';
import { useDocumentoStore } from '../store/documentoStore';

/** Template em branco: A4 com uma banda detail vazia e contrato vazio. */
export function criarTemplateEmBranco(): ReportTemplate {
  return {
    name: 'novo_relatorio',
    pageFormat: {
      pageWidth: 595,
      pageHeight: 842,
      orientation: 'Portrait',
      leftMargin: 20,
      rightMargin: 20,
      topMargin: 30,
      bottomMargin: 30,
      columnCount: 1,
      columnWidth: 555,
      columnSpacing: 0,
    },
    properties: {},
    styles: [],
    dataContract: { fields: [], parameters: [], variables: [] },
    bands: {
      detail: [{ height: 100, splitType: 'Stretch', elements: [] }],
      groups: [],
    },
  };
}

type Familia = 'Comece por aqui' | 'Fiscais e cobrança' | 'Operação' | 'Gerenciais' | 'Etiquetas e crachás' | 'Cartas e documentos';

interface Modelo {
  chave: string;
  familia: Familia;
  titulo: string;
  descricao: string;
  criar: () => ReportTemplate;
}

/** Clona um modelo do catálogo de referência do jrxml-core (ADR-022). */
const doCatalogo = (chave: string) => (): ReportTemplate => structuredClone(REFERENCE_TEMPLATES[chave]!);

/**
 * Modelos da galeria — a chave é a do `REFERENCE_TEMPLATES` (o teste da
 * galeria acusa modelo do catálogo sem entrada aqui). O subreport
 * `fatura_entregas` não entra: é publicado como dependência da fatura (ADR-020).
 */
export const MODELOS: Modelo[] = [
  {
    chave: 'em_branco',
    familia: 'Comece por aqui',
    titulo: 'Em branco',
    descricao: 'Página A4 vazia com uma banda de detalhe. Declare o contrato e monte do zero.',
    criar: criarTemplateEmBranco,
  },
  {
    chave: 'fatura',
    familia: 'Fiscais e cobrança',
    titulo: 'Fatura',
    descricao: 'Fatura A4 com grupo por categoria, tabela de itens zebrada, QR e sub-relatório de entregas.',
    criar: doCatalogo('fatura'),
  },
  {
    chave: 'boleto',
    familia: 'Fiscais e cobrança',
    titulo: 'Boleto de cobrança',
    descricao: 'Recibo do pagador + ficha de compensação com código de barras I2of5 e linha digitável recebidos prontos.',
    criar: doCatalogo('boleto'),
  },
  {
    chave: 'danfe',
    familia: 'Fiscais e cobrança',
    titulo: 'DANFE (NF-e, retrato)',
    descricao: 'Leiaute do MOC: canhoto, chave em CODE-128, emitente repetido em cada folha e produtos em tabela.',
    criar: doCatalogo('danfe'),
  },
  {
    chave: 'orcamento',
    familia: 'Fiscais e cobrança',
    titulo: 'Orçamento / pedido',
    descricao: 'Itens com total por linha (qtd × preço), totais e condições comerciais elásticas.',
    criar: doCatalogo('orcamento'),
  },
  {
    chave: 'comprovante',
    familia: 'Operação',
    titulo: 'Comprovante de entrega',
    descricao: 'Pedido e cliente agrupados (nomes pontuados), tabela de itens e QR de conferência.',
    criar: doCatalogo('comprovante'),
  },
  {
    chave: 'formulario',
    familia: 'Operação',
    titulo: 'Formulário (ficha)',
    descricao: 'Ficha cadastral com rótulos e campos, datas em dd/MM/yyyy e observações elásticas.',
    criar: doCatalogo('formulario'),
  },
  {
    chave: 'listagem_vendas',
    familia: 'Gerenciais',
    titulo: 'Listagem de vendas',
    descricao: 'A4 paisagem com grupo por vendedor, subtotais, total geral e linhas zebradas.',
    criar: doCatalogo('listagem_vendas'),
  },
  {
    chave: 'extrato_conta',
    familia: 'Gerenciais',
    titulo: 'Extrato de conta',
    descricao: 'Lançamentos com saldo acumulado a partir do saldo anterior; débitos em vermelho.',
    criar: doCatalogo('extrato_conta'),
  },
  {
    chave: 'etiqueta_a4',
    familia: 'Etiquetas e crachás',
    titulo: 'Etiqueta A4 (3 colunas)',
    descricao: 'Grade de etiquetas para impressora laser com EAN-13 e preço. (Térmica está fora de escopo.)',
    criar: doCatalogo('etiqueta_a4'),
  },
  {
    chave: 'etiqueta_produto_qr',
    familia: 'Etiquetas e crachás',
    titulo: 'Etiqueta de produto com QR',
    descricao: 'Grade de 4 colunas com nome, SKU, preço, lote e QR.',
    criar: doCatalogo('etiqueta_produto_qr'),
  },
  {
    chave: 'etiqueta_enderecamento',
    familia: 'Etiquetas e crachás',
    titulo: 'Etiqueta de endereçamento',
    descricao: 'Destinatário, remetente e código de rastreio CODE-128, 8 por folha.',
    criar: doCatalogo('etiqueta_enderecamento'),
  },
  {
    chave: 'cracha',
    familia: 'Etiquetas e crachás',
    titulo: 'Crachá',
    descricao: 'Crachás com faixa colorida, foto opcional e QR de identificação, 6 por folha.',
    criar: doCatalogo('cracha'),
  },
  {
    chave: 'carta_declaracao',
    familia: 'Cartas e documentos',
    titulo: 'Carta / declaração',
    descricao: 'Timbre, local e data por extenso, corpo longo justificado e assinatura.',
    criar: doCatalogo('carta_declaracao'),
  },
  {
    chave: 'contrato',
    familia: 'Cartas e documentos',
    titulo: 'Contrato',
    descricao: 'Multipágina: cláusulas, cabeçalho e rubrica em todas as folhas, assinaturas e testemunhas.',
    criar: doCatalogo('contrato'),
  },
];

const FAMILIAS: Familia[] = ['Comece por aqui', 'Fiscais e cobrança', 'Operação', 'Gerenciais', 'Etiquetas e crachás', 'Cartas e documentos'];

function CartaoDeModelo({ modelo }: { modelo: Modelo }) {
  const instancia = useInstancia();
  const novoDocumento = useDocumentoStore((s) => s.novoDocumento);
  const t = modelo.criar();
  return (
    <Card withBorder padding="sm" data-testid={`modelo-${modelo.chave}`}>
      <Stack gap={6} h="100%" justify="space-between">
        <div>
          <Group gap={6} mb={4}>
            <Text fw={600} size="sm">
              {modelo.titulo}
            </Text>
            {t.pageFormat.columnCount > 1 && (
              <Badge size="xs" variant="light" color="violet">{`${t.pageFormat.columnCount} colunas`}</Badge>
            )}
            {t.pageFormat.orientation === 'Landscape' && (
              <Badge size="xs" variant="light" color="teal">
                paisagem
              </Badge>
            )}
          </Group>
          <Text size="xs" c="dimmed">
            {modelo.descricao}
          </Text>
        </div>
        <Group justify="space-between" align="center">
          <Text size="xs" c="dimmed">
            {t.dataContract.fields.length} campo(s) · {t.bands.groups.length} grupo(s)
          </Text>
          <Button size="compact-xs" variant="light" onClick={() => {
              // Documento novo: volta ao editor e descarta o render do anterior (ADR-024).
              instancia.preview.getState().reiniciar();
              novoDocumento(modelo.criar());
            }}>
            Usar
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}

export function Galeria() {
  return (
    <Stack gap="sm" p="md" maw={860} data-testid="galeria">
      <Title order={3}>Novo template</Title>
      <Text size="sm" c="dimmed">
        Comece por um modelo pt-BR — todos contract-first (o relatório declara os campos que espera; os dados
        chegam prontos, sem query embutida).
      </Text>
      {FAMILIAS.map((familia) => (
        <Stack key={familia} gap={6} mt="xs">
          <Text size="xs" fw={700} tt="uppercase" c="dimmed">
            {familia}
          </Text>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
            {MODELOS.filter((m) => m.familia === familia).map((m) => (
              <CartaoDeModelo key={m.chave} modelo={m} />
            ))}
          </SimpleGrid>
        </Stack>
      ))}
    </Stack>
  );
}
