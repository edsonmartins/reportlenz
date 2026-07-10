/**
 * Editor de tabela (RFC-004 §8, Fase 3 bloco 2): add/remove/reorder de
 * colunas, seções header/footer, merge/split via grupos de coluna e binding
 * ao contrato (a coluna nasce ligada a um campo do item da coleção).
 */
import { ActionIcon, Button, Group, NumberInput, Select, Stack, Text, Tooltip } from '@mantine/core';
import type { ColunaDeTabela, TableElement } from '@reportlenz/jrxml-core';
import { contarColunasFolha, eGrupoDeColunas } from '@reportlenz/jrxml-core';
import { useState } from 'react';
import type { CaminhoDeElemento } from '../store/documentoStore';
import { useDocumentoStore } from '../store/documentoStore';
import {
  adicionarColunaDeTabela,
  agruparColunas,
  alternarSecaoDaColuna,
  definirLarguraDaColuna,
  desagruparColunas,
  moverColunaDeTabela,
  removerColunaDeTabela,
} from '../store/mutacoes';

function rotuloDaColuna(col: ColunaDeTabela): string {
  if (eGrupoDeColunas(col)) {
    const titulo = col.header.elements[0];
    return `[grupo] ${titulo?.kind === 'staticText' ? titulo.text : ''} (${contarColunasFolha(col.columns)} col)`;
  }
  const detalhe = col.detail.elements[0];
  if (detalhe?.kind === 'textField') return detalhe.expression;
  const cabecalho = col.header?.elements[0];
  return cabecalho?.kind === 'staticText' ? cabecalho.text : '(coluna)';
}

interface EditorDeTabelaProps {
  caminho: CaminhoDeElemento;
  tabela: TableElement;
}

export function EditorDeTabela({ caminho, tabela }: EditorDeTabelaProps) {
  const template = useDocumentoStore((s) => s.template);
  const mutarTemplate = useDocumentoStore((s) => s.mutarTemplate);
  const [campoNovo, setCampoNovo] = useState<string | null>(null);

  const colecao = template?.dataContract.fields.find((f) => f.name === tabela.datasetField);
  const camposDoItem = colecao?.itemFields ?? [];

  return (
    <Stack gap={6} data-testid="editor-de-tabela">
      <Text size="xs" fw={600}>
        Tabela · $F{'{'}
        {tabela.datasetField}
        {'}'} · {contarColunasFolha(tabela.columns)} coluna(s)
      </Text>

      {tabela.columns.map((col, i) => (
        <Group key={i} gap={4} wrap="nowrap" data-testid={`coluna-${i}`}>
          <Text size="xs" style={{ flex: 1 }} truncate title={rotuloDaColuna(col)}>
            {rotuloDaColuna(col)}
          </Text>

          {!eGrupoDeColunas(col) ? (
            <>
              <NumberInput
                size="xs"
                w={72}
                aria-label={`largura da coluna ${i}`}
                value={col.width}
                onChange={(v) => typeof v === 'number' && mutarTemplate(definirLarguraDaColuna(caminho, i, v))}
              />
              <Tooltip label={col.header ? 'Remover cabeçalho' : 'Adicionar cabeçalho'}>
                <Button
                  size="compact-xs"
                  variant={col.header ? 'filled' : 'default'}
                  aria-label={`cabeçalho da coluna ${i}`}
                  onClick={() => mutarTemplate(alternarSecaoDaColuna(caminho, i, 'header'))}
                >
                  H
                </Button>
              </Tooltip>
              <Tooltip label={col.footer ? 'Remover rodapé' : 'Adicionar rodapé (totais)'}>
                <Button
                  size="compact-xs"
                  variant={col.footer ? 'filled' : 'default'}
                  aria-label={`rodapé da coluna ${i}`}
                  onClick={() => mutarTemplate(alternarSecaoDaColuna(caminho, i, 'footer'))}
                >
                  F
                </Button>
              </Tooltip>
            </>
          ) : (
            <Tooltip label="Desagrupar (split): promove as colunas filhas">
              <Button
                size="compact-xs"
                variant="default"
                aria-label={`desagrupar ${i}`}
                onClick={() => mutarTemplate(desagruparColunas(caminho, i))}
              >
                Split
              </Button>
            </Tooltip>
          )}

          {i < tabela.columns.length - 1 && (
            <Tooltip label="Agrupar (merge) com a próxima sob um cabeçalho comum">
              <Button
                size="compact-xs"
                variant="default"
                aria-label={`agrupar ${i}`}
                onClick={() => mutarTemplate(agruparColunas(caminho, i))}
              >
                Merge
              </Button>
            </Tooltip>
          )}
          <ActionIcon
            size="xs"
            variant="subtle"
            aria-label={`mover coluna ${i} para a esquerda`}
            disabled={i === 0}
            onClick={() => mutarTemplate(moverColunaDeTabela(caminho, i, i - 1))}
          >
            ←
          </ActionIcon>
          <ActionIcon
            size="xs"
            variant="subtle"
            aria-label={`mover coluna ${i} para a direita`}
            disabled={i === tabela.columns.length - 1}
            onClick={() => mutarTemplate(moverColunaDeTabela(caminho, i, i + 1))}
          >
            →
          </ActionIcon>
          <ActionIcon
            size="xs"
            variant="subtle"
            color="red"
            aria-label={`remover coluna ${i}`}
            onClick={() => mutarTemplate(removerColunaDeTabela(caminho, i))}
          >
            ×
          </ActionIcon>
        </Group>
      ))}

      {camposDoItem.length > 0 ? (
        <Group gap={4} wrap="nowrap">
          <Select
            size="xs"
            style={{ flex: 1 }}
            aria-label="campo do contrato para a nova coluna"
            placeholder="campo do item…"
            data={camposDoItem.map((f) => f.name)}
            value={campoNovo}
            onChange={setCampoNovo}
          />
          <Button
            size="compact-xs"
            variant="light"
            disabled={!campoNovo}
            onClick={() => {
              const campo = camposDoItem.find((f) => f.name === campoNovo);
              if (campo) mutarTemplate(adicionarColunaDeTabela(caminho, campo));
            }}
          >
            Adicionar coluna
          </Button>
        </Group>
      ) : (
        <Text size="xs" c="dimmed">
          Declare campos de item na coleção {tabela.datasetField} (painel Contrato) para adicionar colunas.
        </Text>
      )}
    </Stack>
  );
}
