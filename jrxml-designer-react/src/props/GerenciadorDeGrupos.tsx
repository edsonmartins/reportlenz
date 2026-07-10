/**
 * Gerenciador de grupos com subtotais (Fase 3, bloco 5 / RFC-004 §8).
 * Vive no painel de documento (sem seleção), ao lado dos estilos.
 */
import { Accordion, ActionIcon, Badge, Button, Checkbox, Group, Select, Stack, Text, TextInput, Tooltip } from '@mantine/core';
import { useState } from 'react';
import { ExpressionEditor } from '../expression/ExpressionEditor';
import { escopoMaster } from '../expression/sugestoes';
import { useDocumentoStore } from '../store/documentoStore';
import {
  adicionarGrupo,
  adicionarSubtotalAoGrupo,
  alternarBandaDoGrupo,
  atualizarGrupo,
  removerGrupo,
} from '../store/mutacoes';

export function GerenciadorDeGrupos() {
  const template = useDocumentoStore((s) => s.template);
  const mutarTemplate = useDocumentoStore((s) => s.mutarTemplate);
  const [novoNome, setNovoNome] = useState('');
  const [campoSubtotal, setCampoSubtotal] = useState<string | null>(null);

  if (!template) return null;
  const escopo = escopoMaster(template.dataContract, template.bands.groups.map((g) => g.name));
  const camposNumericos = template.dataContract.fields.filter((f) => f.type === 'decimal' || f.type === 'integer');

  const criar = () => {
    const nome = novoNome.trim();
    if (!nome) return;
    // A quebra nasce apontando para o primeiro campo do contrato (ajustável).
    const primeiroCampo = template.dataContract.fields[0]?.name ?? 'campo';
    mutarTemplate(adicionarGrupo(nome, `$F{${primeiroCampo}}`));
    setNovoNome('');
  };

  return (
    <Stack gap={6} data-testid="gerenciador-de-grupos">
      <Text size="xs" c="dimmed">
        Grupos quebram o relatório por expressão; subtotais somam um campo numérico no rodapé do grupo.
      </Text>

      <Group gap={4} wrap="nowrap">
        <TextInput
          size="xs"
          style={{ flex: 1 }}
          placeholder="nome do novo grupo"
          aria-label="nome do novo grupo"
          value={novoNome}
          onChange={(e) => setNovoNome(e.currentTarget.value)}
          onKeyDown={(e) => e.key === 'Enter' && criar()}
        />
        <Button size="compact-xs" variant="light" onClick={criar}>
          Criar grupo
        </Button>
      </Group>

      <Accordion multiple variant="separated" transitionDuration={0}>
        {template.bands.groups.map((grupo) => (
          <Accordion.Item key={grupo.name} value={grupo.name} data-testid={`grupo-${grupo.name}`}>
            <Accordion.Control>
              <Group gap={6}>
                <Text size="xs" fw={600}>
                  {grupo.name}
                </Text>
                <Badge size="xs" variant="light">
                  {grupo.expression}
                </Badge>
              </Group>
            </Accordion.Control>
            <Accordion.Panel>
              <Stack gap={6}>
                <ExpressionEditor
                  valor={grupo.expression}
                  escopo={escopo}
                  aria-label={`expressão do grupo ${grupo.name}`}
                  onCommit={(v) => mutarTemplate(atualizarGrupo(grupo.name, { expression: v }))}
                />
                <Group gap={6} wrap="nowrap">
                  <Checkbox
                    size="xs"
                    label="nova página a cada quebra"
                    aria-label={`nova página ${grupo.name}`}
                    checked={grupo.startNewPage ?? false}
                    onChange={(e) =>
                      mutarTemplate(atualizarGrupo(grupo.name, { startNewPage: e.currentTarget.checked || undefined }))
                    }
                  />
                  <Tooltip label={grupo.header ? 'Remover cabeçalho do grupo' : 'Adicionar cabeçalho do grupo'}>
                    <Button
                      size="compact-xs"
                      variant={grupo.header ? 'filled' : 'default'}
                      aria-label={`cabeçalho do grupo ${grupo.name}`}
                      onClick={() => mutarTemplate(alternarBandaDoGrupo(grupo.name, 'header'))}
                    >
                      H
                    </Button>
                  </Tooltip>
                  <Tooltip label={grupo.footer ? 'Remover rodapé do grupo' : 'Adicionar rodapé (subtotais)'}>
                    <Button
                      size="compact-xs"
                      variant={grupo.footer ? 'filled' : 'default'}
                      aria-label={`rodapé do grupo ${grupo.name}`}
                      onClick={() => mutarTemplate(alternarBandaDoGrupo(grupo.name, 'footer'))}
                    >
                      F
                    </Button>
                  </Tooltip>
                  <ActionIcon
                    size="xs"
                    variant="subtle"
                    color="red"
                    aria-label={`remover grupo ${grupo.name}`}
                    onClick={() => mutarTemplate(removerGrupo(grupo.name))}
                  >
                    ×
                  </ActionIcon>
                </Group>

                {camposNumericos.length > 0 ? (
                  <Group gap={4} wrap="nowrap">
                    <Select
                      size="xs"
                      style={{ flex: 1 }}
                      aria-label={`campo do subtotal de ${grupo.name}`}
                      placeholder="campo numérico…"
                      data={camposNumericos.map((f) => f.name)}
                      value={campoSubtotal}
                      onChange={setCampoSubtotal}
                    />
                    <Tooltip label="Cria a variável Sum (reset no grupo) e o campo no rodapé">
                      <Button
                        size="compact-xs"
                        variant="light"
                        disabled={!campoSubtotal}
                        onClick={() => {
                          const campo = camposNumericos.find((f) => f.name === campoSubtotal);
                          if (campo) mutarTemplate(adicionarSubtotalAoGrupo(grupo.name, campo));
                        }}
                      >
                        + Subtotal
                      </Button>
                    </Tooltip>
                  </Group>
                ) : (
                  <Text size="xs" c="dimmed">
                    Declare um campo numérico (decimal/integer) no contrato para criar subtotais.
                  </Text>
                )}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion>
    </Stack>
  );
}
