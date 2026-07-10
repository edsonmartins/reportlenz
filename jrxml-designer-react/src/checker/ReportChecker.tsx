/**
 * ReportChecker (ADR-005/RFC-004 §2, tarefa phase-2/6.1): o painel de
 * problemas no lugar de erro críptico no save. Lista as mensagens da
 * validação contínua (dialeto 7 + contrato, com código/mensagem/caminho);
 * clicar num problema de elemento SELECIONA o elemento no canvas.
 */
import { Badge, Group, ScrollArea, Stack, Text, UnstyledButton } from '@mantine/core';
import { useState } from 'react';
import { useDocumentoStore } from '../store/documentoStore';
import { caminhoDoProblema } from './caminhos';

const COR_POR_CODIGO: Record<string, string> = {
  CONTRACT_PULL_FORBIDDEN: 'red',
  LEGACY_DIALECT: 'orange',
  EXPR_UNKNOWN_REF: 'red',
  XML_MALFORMED: 'red',
  UNSUPPORTED_ELEMENT: 'orange',
  UNSUPPORTED_TYPE: 'orange',
  INVALID_ATTRIBUTE: 'yellow',
};

export function ReportChecker() {
  const template = useDocumentoStore((s) => s.template);
  const problemas = useDocumentoStore((s) => s.problemas);
  const selecionar = useDocumentoStore((s) => s.selecionar);
  const [expandido, setExpandido] = useState(true);

  if (!template) return null;

  return (
    <section
      data-testid="report-checker"
      style={{ borderTop: '1px solid var(--mantine-color-gray-3)', background: 'var(--mantine-color-gray-0)' }}
    >
      <UnstyledButton
        onClick={() => setExpandido((e) => !e)}
        aria-label="alternar painel de problemas"
        style={{ width: '100%' }}
        px="sm"
        py={4}
      >
        <Group gap="xs">
          <Text size="xs" fw={600}>
            Problemas
          </Text>
          <Badge size="xs" color={problemas.length === 0 ? 'green' : 'red'} variant="light">
            {problemas.length}
          </Badge>
          <Text size="xs" c="dimmed">
            {expandido ? '▾' : '▸'}
          </Text>
        </Group>
      </UnstyledButton>

      {expandido && (
        <ScrollArea.Autosize mah={140} px="sm" pb={6}>
          {problemas.length === 0 ? (
            <Text size="xs" c="dimmed" data-testid="checker-vazio">
              Nenhum problema — template válido no dialeto 7 e íntegro com o contrato.
            </Text>
          ) : (
            <Stack gap={2}>
              {problemas.map((p, i) => {
                const caminho = caminhoDoProblema(template, p.path);
                const conteudo = (
                  <Group gap={6} wrap="nowrap" align="baseline">
                    <Badge size="xs" variant="light" color={COR_POR_CODIGO[p.code] ?? 'gray'} style={{ flexShrink: 0 }}>
                      {p.code}
                    </Badge>
                    <Text size="xs" style={{ flex: 1 }}>
                      {p.message}
                    </Text>
                    {p.path && (
                      <Text size="xs" c="dimmed" ff="monospace" style={{ flexShrink: 0 }}>
                        {p.path}
                        {p.line !== undefined ? `:${p.line}` : ''}
                      </Text>
                    )}
                  </Group>
                );
                return caminho ? (
                  <UnstyledButton
                    key={i}
                    data-testid={`problema-${i}`}
                    aria-label={`ir para o problema: ${p.message}`}
                    onClick={() => selecionar(caminho)}
                    style={{ borderRadius: 4 }}
                  >
                    {conteudo}
                  </UnstyledButton>
                ) : (
                  <div key={i} data-testid={`problema-${i}`}>
                    {conteudo}
                  </div>
                );
              })}
            </Stack>
          )}
        </ScrollArea.Autosize>
      )}
    </section>
  );
}
