/**
 * Gerenciador de estilos (Fase 3, bloco 4): estilos nomeados com herança
 * (4.1) e estilos condicionais (4.2 — destacar linhas por condição, com o
 * expression editor). Aparece no painel direito quando NADA está selecionado
 * (propriedades do documento).
 */
import {
  Accordion,
  ActionIcon,
  Badge,
  Button,
  Checkbox,
  Group,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import type { Style } from '@reportlenz/jrxml-core';
import { useState } from 'react';
import { ExpressionEditor } from '../expression/ExpressionEditor';
import { escopoMaster } from '../expression/sugestoes';
import { useDocumentoStore } from '../store/documentoStore';
import {
  adicionarCondicaoDeEstilo,
  adicionarEstilo,
  atualizarCondicaoDeEstilo,
  atualizarEstilo,
  removerCondicaoDeEstilo,
  removerEstilo,
} from '../store/mutacoes';

export function GerenciadorDeEstilos() {
  const template = useDocumentoStore((s) => s.template);
  const mutarTemplate = useDocumentoStore((s) => s.mutarTemplate);
  const [novoNome, setNovoNome] = useState('');

  if (!template) return null;
  const escopo = escopoMaster(template.dataContract, template.bands.groups.map((g) => g.name));

  const criar = () => {
    if (!novoNome.trim()) return;
    mutarTemplate(adicionarEstilo(novoNome));
    setNovoNome('');
  };

  const paisPossiveis = (estilo: Style) => template.styles.filter((s) => s.name !== estilo.name).map((s) => s.name);

  return (
    <Stack gap={6} p="sm" data-testid="gerenciador-de-estilos" style={{ overflow: 'auto' }}>
      <Text size="sm" fw={600}>
        Estilos do documento
      </Text>
      <Text size="xs" c="dimmed">
        Estilos nomeados com herança; condições destacam linhas quando a expressão for verdadeira.
      </Text>

      <Group gap={4} wrap="nowrap">
        <TextInput
          size="xs"
          style={{ flex: 1 }}
          placeholder="nome do novo estilo"
          aria-label="nome do novo estilo"
          value={novoNome}
          onChange={(e) => setNovoNome(e.currentTarget.value)}
          onKeyDown={(e) => e.key === 'Enter' && criar()}
        />
        <Button size="compact-xs" variant="light" onClick={criar}>
          Criar estilo
        </Button>
      </Group>

      <Accordion multiple variant="separated" transitionDuration={0}>
        {template.styles.map((estilo) => (
          <Accordion.Item key={estilo.name} value={estilo.name} data-testid={`estilo-${estilo.name}`}>
            <Accordion.Control>
              <Group gap={6}>
                <Text size="xs" fw={600}>
                  {estilo.name}
                </Text>
                {estilo.isDefault && (
                  <Badge size="xs" variant="light" color="green">
                    default
                  </Badge>
                )}
                {estilo.parentStyleRef && (
                  <Text size="xs" c="dimmed">
                    herda de {estilo.parentStyleRef}
                  </Text>
                )}
              </Group>
            </Accordion.Control>
            <Accordion.Panel>
              <Stack gap={6}>
                <Group gap={6} wrap="nowrap">
                  <Select
                    size="xs"
                    style={{ flex: 1 }}
                    aria-label={`pai de ${estilo.name}`}
                    placeholder="(sem pai)"
                    data={paisPossiveis(estilo)}
                    value={estilo.parentStyleRef ?? null}
                    onChange={(v) => mutarTemplate(atualizarEstilo(estilo.name, { parentStyleRef: v ?? undefined }))}
                    clearable
                  />
                  <Tooltip label="Estilo default do documento (só um)">
                    <Checkbox
                      size="xs"
                      label="default"
                      aria-label={`default ${estilo.name}`}
                      checked={estilo.isDefault ?? false}
                      onChange={(e) =>
                        mutarTemplate(atualizarEstilo(estilo.name, { isDefault: e.currentTarget.checked || undefined }))
                      }
                    />
                  </Tooltip>
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    color="red"
                    aria-label={`remover estilo ${estilo.name}`}
                    onClick={() => mutarTemplate(removerEstilo(estilo.name))}
                  >
                    ×
                  </ActionIcon>
                </Group>

                <Group gap={6} wrap="nowrap">
                  <TextInput
                    size="xs"
                    style={{ flex: 1 }}
                    aria-label={`fonte de ${estilo.name}`}
                    placeholder="fonte"
                    value={estilo.fontName ?? ''}
                    onChange={(e) =>
                      mutarTemplate(atualizarEstilo(estilo.name, { fontName: e.currentTarget.value || undefined }))
                    }
                  />
                  <NumberInput
                    size="xs"
                    w={72}
                    aria-label={`tamanho de ${estilo.name}`}
                    placeholder="pt"
                    value={estilo.fontSize ?? ''}
                    onChange={(v) =>
                      mutarTemplate(atualizarEstilo(estilo.name, { fontSize: typeof v === 'number' ? v : undefined }))
                    }
                  />
                  <Checkbox
                    size="xs"
                    label="negrito"
                    aria-label={`negrito ${estilo.name}`}
                    checked={estilo.bold ?? false}
                    onChange={(e) =>
                      mutarTemplate(atualizarEstilo(estilo.name, { bold: e.currentTarget.checked || undefined }))
                    }
                  />
                </Group>

                <Text size="xs" fw={600}>
                  Condições ({estilo.conditionalStyles?.length ?? 0})
                </Text>
                {(estilo.conditionalStyles ?? []).map((cs, i) => (
                  <Stack key={i} gap={4} pl="xs" style={{ borderLeft: '2px solid var(--mantine-color-orange-3)' }} data-testid={`condicao-${estilo.name}-${i}`}>
                    <ExpressionEditor
                      valor={cs.conditionExpression}
                      escopo={escopo}
                      aria-label={`condição ${i} de ${estilo.name}`}
                      onCommit={(v) => mutarTemplate(atualizarCondicaoDeEstilo(estilo.name, i, { conditionExpression: v }))}
                    />
                    <Group gap={4} wrap="nowrap">
                      <TextInput
                        size="xs"
                        style={{ flex: 1 }}
                        aria-label={`fundo da condição ${i} de ${estilo.name}`}
                        placeholder="#F0F0F0"
                        value={cs.style.backcolor ?? ''}
                        onChange={(e) =>
                          mutarTemplate(
                            atualizarCondicaoDeEstilo(estilo.name, i, {
                              style: { ...cs.style, mode: 'Opaque', backcolor: e.currentTarget.value || undefined },
                            }),
                          )
                        }
                      />
                      <Checkbox
                        size="xs"
                        label="negrito"
                        aria-label={`negrito da condição ${i} de ${estilo.name}`}
                        checked={cs.style.bold ?? false}
                        onChange={(e) =>
                          mutarTemplate(
                            atualizarCondicaoDeEstilo(estilo.name, i, {
                              style: { ...cs.style, bold: e.currentTarget.checked || undefined },
                            }),
                          )
                        }
                      />
                      <ActionIcon
                        size="xs"
                        variant="subtle"
                        color="red"
                        aria-label={`remover condição ${i} de ${estilo.name}`}
                        onClick={() => mutarTemplate(removerCondicaoDeEstilo(estilo.name, i))}
                      >
                        ×
                      </ActionIcon>
                    </Group>
                  </Stack>
                ))}
                <Button
                  size="compact-xs"
                  variant="default"
                  onClick={() => mutarTemplate(adicionarCondicaoDeEstilo(estilo.name))}
                >
                  + condição (zebra por padrão)
                </Button>
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    </Stack>
  );
}
