/**
 * Publish Wizard (RFC-006 §3 + RFC-002 §6; tarefas phase-4/4.1-4.3).
 *
 * Duas camadas de gates, AMBAS obrigatórias:
 * 1. design-time: `avaliarGates` (jrxml-core) — G1 estrutural, G2, G3, G4, G5, G6;
 * 2. autoritativa: `POST /publish/verificar` — G1 = load+compile pela Library
 *    7.0.7 real (ADR-013), G2/G5/G6 reconferidos pelo serviço.
 * O botão de publicar SÓ habilita com tudo verde ("Pass 5 = autoridade sobre
 * done", I-5). O resultado hoje é o pacote de integração (RFC-002 §6); a
 * persistência do registro (ADR-009) chega no bloco 5.
 */
import { Alert, Badge, Button, Group, Modal, Stack, Text } from '@mantine/core';
import type { ResultadoDosGates } from '@reportlenz/jrxml-core';
import { avaliarGates, buildIntegrationPackage } from '@reportlenz/jrxml-core';
import { useEffect, useState } from 'react';
import { useDocumentoStore } from '../store/documentoStore';

interface GateDoServico {
  gate: string;
  verde: boolean;
  erros: string[];
}

interface VerificacaoDoServico {
  verde: boolean;
  gates: GateDoServico[];
  jrxmlHash: string;
}

export function PublishWizard({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const template = useDocumentoStore((s) => s.template);
  const [resultado, setResultado] = useState<ResultadoDosGates | null>(null);
  const [servico, setServico] = useState<VerificacaoDoServico | null>(null);
  const [erroDoServico, setErroDoServico] = useState<string | null>(null);
  const [publicado, setPublicado] = useState(false);

  useEffect(() => {
    if (!aberto || !template) return;
    setPublicado(false);
    setServico(null);
    setErroDoServico(null);

    // Camada 1 — design-time (instantânea).
    const local = avaliarGates(template);
    setResultado(local);

    // Camada 2 — autoridade (Library real). Sem ela não há publish.
    if (!local.jrxml) return;
    void (async () => {
      try {
        const resposta = await fetch('/publish/verificar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jrxml: local.jrxml, inputSchema: local.inputSchema, jrxmlHash: local.jrxmlHash }),
        });
        if (!resposta.ok) {
          setErroDoServico(`serviço de render respondeu HTTP ${resposta.status}`);
          return;
        }
        setServico((await resposta.json()) as VerificacaoDoServico);
      } catch (e) {
        setErroDoServico(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [aberto, template]);

  if (!template) return null;

  const tudoVerde = (resultado?.verde ?? false) && (servico?.verde ?? false);

  const publicar = () => {
    if (!tudoVerde || !template) return;
    const pacote = buildIntegrationPackage(template, { version: 1 });
    const blob = new Blob([JSON.stringify(pacote, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pacote.registro.templateName}-v${pacote.registro.version}.reportlenz.json`;
    a.click();
    URL.revokeObjectURL(url);
    setPublicado(true);
  };

  const gateDoServico = (codigo: string) => servico?.gates.find((g) => g.gate === codigo);

  return (
    <Modal opened={aberto} onClose={onFechar} title="Publicar — gates de governança (G1–G6)"
      size={560} transitionProps={{ duration: 0 }}>
      <Stack gap={6}>
        {resultado?.gates.map((g) => {
          const confirmacao = gateDoServico(g.gate);
          const verde = g.verde && (confirmacao ? confirmacao.verde : true);
          const erros = [...g.erros.map((e) => e.message), ...(confirmacao?.erros ?? [])];
          return (
            <Group key={g.gate} gap={8} align="flex-start" data-testid={`gate-${g.gate}`} data-verde={verde || undefined}>
              <Badge color={verde ? 'green' : 'red'} variant="filled" w={44}>
                {g.gate}
              </Badge>
              <div style={{ flex: 1 }}>
                <Text size="xs">
                  {g.titulo}
                  {confirmacao?.verde && g.gate === 'G1' && ' — confirmado pela Library 7.0.7'}
                </Text>
                {!verde &&
                  erros.slice(0, 3).map((e, i) => (
                    <Text size="xs" c="red.7" key={i}>
                      • {e}
                    </Text>
                  ))}
              </div>
            </Group>
          );
        })}

        {erroDoServico && (
          <Alert color="red" p="xs" data-testid="publish-sem-autoridade">
            <Text size="xs">
              Não foi possível confirmar os gates pela Library real ({erroDoServico}). Sem a
              verificação autoritativa o publish fica BLOQUEADO (I-5).
            </Text>
          </Alert>
        )}
        {!servico && !erroDoServico && resultado?.jrxml && (
          <Text size="xs" c="dimmed">
            Confirmando pela Library 7.0.7 (serviço de render)…
          </Text>
        )}

        <Group justify="space-between" mt={6}>
          <Text size="xs" c="dimmed">
            hash: {resultado?.jrxmlHash.slice(0, 16)}…
          </Text>
          <Button size="compact-sm" disabled={!tudoVerde} onClick={publicar} data-testid="publish-confirmar">
            Gerar pacote de integração
          </Button>
        </Group>
        {publicado && (
          <Text size="xs" c="green" data-testid="publish-ok">
            ✓ Pacote de integração gerado (registro + JRXML + inputSchema + tipos TS + record Java).
            O registro persistente de versões (ADR-009) chega no próximo bloco.
          </Text>
        )}
      </Stack>
    </Modal>
  );
}
