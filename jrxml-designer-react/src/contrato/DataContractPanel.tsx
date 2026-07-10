/**
 * DataContractPanel (RFC-004 §6, ADR-003 — tarefas phase-2/4.1-4.2).
 *
 * A tese do produto: em vez de "qual query?", o painel pergunta
 * **"quais campos este relatório espera e de que tipo?"**. Declara fields
 * (escalar, objeto via nomes pontuados, coleção com campos de item),
 * parameters e variables — e mostra o `inputSchema` gerado pelo core ao vivo.
 *
 * NUNCA oferece Query Editor, conexão JDBC ou Query Preview — não existe
 * sequer API para isso (contract-first por construção).
 */
import {
  Accordion,
  ActionIcon,
  Badge,
  Button,
  Checkbox,
  Group,
  ScrollArea,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import type { FieldDecl, ScalarType, VariableCalculation } from '@reportlenz/jrxml-core';
import { buildInputSchema, extractContract } from '@reportlenz/jrxml-core';
import { useMemo, useState } from 'react';
import { useDocumentoStore } from '../store/documentoStore';
import { comContrato } from '../store/mutacoes';

const LARGURA_DO_PAINEL = 320;

const TIPOS_ESCALARES: ScalarType[] = ['string', 'integer', 'decimal', 'boolean', 'date', 'datetime'];
const TIPOS_DE_FIELD = [...TIPOS_ESCALARES, 'collection'];
const CALCULOS: VariableCalculation[] = ['Nothing', 'Count', 'DistinctCount', 'Sum', 'Average', 'Lowest', 'Highest', 'First'];

/** Formulário compacto de adição (nome + tipo). */
function AdicionarDecl({
  tipos,
  onAdicionar,
  placeholder,
}: {
  tipos: string[];
  onAdicionar: (nome: string, tipo: string) => void;
  placeholder: string;
}) {
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState(tipos[0] ?? 'string');
  const adicionar = () => {
    const limpo = nome.trim();
    if (!limpo) return;
    onAdicionar(limpo, tipo ?? 'string');
    setNome('');
  };
  return (
    <Group gap={4} wrap="nowrap">
      <TextInput
        size="xs"
        placeholder={placeholder}
        aria-label={placeholder}
        value={nome}
        onChange={(e) => setNome(e.currentTarget.value)}
        onKeyDown={(e) => e.key === 'Enter' && adicionar()}
        style={{ flex: 1 }}
      />
      <Select size="xs" w={104} aria-label="tipo" data={tipos} value={tipo} onChange={(v) => setTipo(v ?? 'string')} />
      <Button size="compact-xs" variant="light" onClick={adicionar}>
        Adicionar
      </Button>
    </Group>
  );
}

export function DataContractPanel() {
  const template = useDocumentoStore((s) => s.template);
  const mutarTemplate = useDocumentoStore((s) => s.mutarTemplate);

  // Memo pelo CONTRATO (referência estável entre mutações de bounds/drag):
  // arrastar elementos não recalcula o schema.
  const contrato = template?.dataContract;
  const nome = template?.name;
  const schemaJson = useMemo(() => {
    if (!template || !contrato) return '';
    return JSON.stringify(
      buildInputSchema(extractContract(template), { templateName: nome, version: 1 }),
      null,
      2,
    );
  }, [contrato, nome]);

  if (!template || !contrato) return null;

  const mudar = (atualizar: Parameters<typeof comContrato>[1]) => mutarTemplate((t) => comContrato(t, atualizar));

  const linhaDeField = (f: FieldDecl, atualizar: (novo: FieldDecl | null) => void, aninhado = false) => (
    <Stack key={f.name} gap={2}>
      <Group gap={4} wrap="nowrap" data-testid={`field-${f.name}`}>
        <Text size="xs" style={{ flex: 1 }} truncate title={f.name}>
          {f.name}
        </Text>
        <Select
          size="xs"
          w={104}
          aria-label={`tipo de ${f.name}`}
          data={aninhado ? TIPOS_ESCALARES : TIPOS_DE_FIELD}
          value={f.type}
          onChange={(v) => {
            if (!v) return;
            const tipo = v as FieldDecl['type'];
            const novo: FieldDecl = { ...f, type: tipo };
            if (tipo !== 'collection') delete novo.itemFields;
            atualizar(novo);
          }}
        />
        <Tooltip label="Obrigatório no payload (required do inputSchema)">
          <Checkbox
            size="xs"
            aria-label={`obrigatório ${f.name}`}
            checked={f.required ?? false}
            onChange={(e) => atualizar({ ...f, required: e.currentTarget.checked || undefined })}
          />
        </Tooltip>
        <ActionIcon size="xs" variant="subtle" color="red" aria-label={`remover ${f.name}`} onClick={() => atualizar(null)}>
          ×
        </ActionIcon>
      </Group>

      {f.type === 'collection' && (
        <Stack gap={2} pl="md" style={{ borderLeft: '2px solid var(--mantine-color-blue-2)' }}>
          {(f.itemFields ?? []).map((item) =>
            linhaDeField(
              item,
              (novoItem) =>
                atualizar({
                  ...f,
                  itemFields: novoItem
                    ? (f.itemFields ?? []).map((x) => (x.name === item.name ? novoItem : x))
                    : (f.itemFields ?? []).filter((x) => x.name !== item.name),
                }),
              true,
            ),
          )}
          <AdicionarDecl
            tipos={TIPOS_ESCALARES}
            placeholder={`campo do item de ${f.name}`}
            onAdicionar={(nome, tipo) =>
              atualizar({ ...f, itemFields: [...(f.itemFields ?? []), { name: nome, type: tipo as ScalarType }] })
            }
          />
        </Stack>
      )}
    </Stack>
  );

  return (
    <aside
      data-testid="data-contract-panel"
      style={{
        width: LARGURA_DO_PAINEL,
        borderRight: '1px solid var(--mantine-color-gray-3)',
        background: 'var(--mantine-color-gray-0)',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      <Group gap="xs" p="sm" pb={4}>
        <Text size="sm" fw={600}>
          Contrato de dados
        </Text>
        <Badge size="xs" variant="light">
          Push
        </Badge>
      </Group>
      <Text size="xs" c="dimmed" px="sm" pb={4}>
        Quais campos este relatório espera — e de que tipo? Nomes pontuados (ex.: cliente.nome) viram objeto aninhado;
        coleções alimentam tabelas.
      </Text>

      <ScrollArea style={{ flex: 1 }} px="sm" pb="sm">
        <Accordion multiple defaultValue={['fields']} variant="separated" transitionDuration={0}>
          <Accordion.Item value="fields">
            <Accordion.Control>
              <Text size="xs" fw={600}>{`Campos (${contrato.fields.length})`}</Text>
            </Accordion.Control>
            <Accordion.Panel>
              <Stack gap={6}>
                {contrato.fields.map((f) =>
                  linhaDeField(f, (novo) =>
                    mudar((c) => ({
                      ...c,
                      fields: novo ? c.fields.map((x) => (x.name === f.name ? novo : x)) : c.fields.filter((x) => x.name !== f.name),
                    })),
                  ),
                )}
                <AdicionarDecl
                  tipos={TIPOS_DE_FIELD}
                  placeholder="nome do campo (ex.: cliente.nome)"
                  onAdicionar={(nome, tipo) =>
                    mudar((c) => ({ ...c, fields: [...c.fields, { name: nome, type: tipo as FieldDecl['type'] }] }))
                  }
                />
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="parameters">
            <Accordion.Control>
              <Text size="xs" fw={600}>{`Parâmetros (${contrato.parameters.length})`}</Text>
            </Accordion.Control>
            <Accordion.Panel>
              <Stack gap={6}>
                {contrato.parameters.map((p) => (
                  <Group key={p.name} gap={4} wrap="nowrap" data-testid={`param-${p.name}`}>
                    <Text size="xs" style={{ flex: 1 }} truncate>
                      {p.name}
                    </Text>
                    <Select
                      size="xs"
                      w={104}
                      aria-label={`tipo de ${p.name}`}
                      data={TIPOS_ESCALARES}
                      value={p.type}
                      onChange={(v) =>
                        v && mudar((c) => ({ ...c, parameters: c.parameters.map((x) => (x.name === p.name ? { ...x, type: v } : x)) }))
                      }
                    />
                    <ActionIcon
                      size="xs"
                      variant="subtle"
                      color="red"
                      aria-label={`remover ${p.name}`}
                      onClick={() => mudar((c) => ({ ...c, parameters: c.parameters.filter((x) => x.name !== p.name) }))}
                    >
                      ×
                    </ActionIcon>
                  </Group>
                ))}
                <AdicionarDecl
                  tipos={TIPOS_ESCALARES}
                  placeholder="nome do parâmetro"
                  onAdicionar={(nome, tipo) =>
                    mudar((c) => ({ ...c, parameters: [...c.parameters, { name: nome, type: tipo as ScalarType }] }))
                  }
                />
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="variables">
            <Accordion.Control>
              <Text size="xs" fw={600}>{`Variáveis (${contrato.variables.length}) — calculadas, fora do payload`}</Text>
            </Accordion.Control>
            <Accordion.Panel>
              <Stack gap={6}>
                {contrato.variables.map((v) => (
                  <Group key={v.name} gap={4} wrap="nowrap" data-testid={`var-${v.name}`}>
                    <Text size="xs" style={{ flex: 1 }} truncate>
                      {v.name}
                    </Text>
                    <Select
                      size="xs"
                      w={92}
                      aria-label={`cálculo de ${v.name}`}
                      data={CALCULOS}
                      value={v.calculation}
                      onChange={(sel) =>
                        sel &&
                        mudar((c) => ({
                          ...c,
                          variables: c.variables.map((x) => (x.name === v.name ? { ...x, calculation: sel } : x)),
                        }))
                      }
                    />
                    <ActionIcon
                      size="xs"
                      variant="subtle"
                      color="red"
                      aria-label={`remover ${v.name}`}
                      onClick={() => mudar((c) => ({ ...c, variables: c.variables.filter((x) => x.name !== v.name) }))}
                    >
                      ×
                    </ActionIcon>
                  </Group>
                ))}
                <AdicionarDecl
                  tipos={TIPOS_ESCALARES}
                  placeholder="nome da variável"
                  onAdicionar={(nome, tipo) =>
                    mudar((c) => ({
                      ...c,
                      variables: [...c.variables, { name: nome, type: tipo as ScalarType, calculation: 'Sum' }],
                    }))
                  }
                />
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value="schema">
            <Accordion.Control>
              <Text size="xs" fw={600}>
                inputSchema (gerado pelo core)
              </Text>
            </Accordion.Control>
            <Accordion.Panel>
              <pre
                data-testid="input-schema"
                style={{ fontSize: 10, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
              >
                {schemaJson}
              </pre>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      </ScrollArea>
    </aside>
  );
}
