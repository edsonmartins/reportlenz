/**
 * Assistente de IA — NL → relatório (Fase 4, RFC-005 §2, ADR-014).
 *
 * Padrão do copiloto do mentors-ipaas-admin: Drawer lateral, REST sem
 * streaming, e a saída da IA é um RASCUNHO revisável — o usuário vê o resumo
 * e os problemas de validação ANTES de clicar "Carregar rascunho no editor"
 * (a IA não fura gates: validateSchema + validateContract rodam aqui e a
 * validação contínua segue valendo no canvas).
 */
import { Alert, Badge, Button, Checkbox, Drawer, Group, Stack, Text, Textarea } from '@mantine/core';
import type { ParseError, ReportTemplate } from '@reportlenz/jrxml-core';
import { useState } from 'react';
import { useDocumentoStore, validarDocumento } from '../store/documentoStore';
import { normalizarDraft } from './normalizarDraft';

interface RespostaDoAssistente {
  template: unknown;
  observacoes: string;
  modelo: string;
}

interface Rascunho {
  template: ReportTemplate;
  problemas: ParseError[];
  observacoes: string;
  modelo: string;
}

function contarElementos(t: ReportTemplate): number {
  const deBanda = (b?: { elements: unknown[] }) => b?.elements.length ?? 0;
  const bands = t.bands;
  return (
    deBanda(bands.title) + deBanda(bands.background) + deBanda(bands.pageHeader) +
    deBanda(bands.columnHeader) + deBanda(bands.columnFooter) + deBanda(bands.pageFooter) +
    deBanda(bands.summary) + deBanda(bands.noData) +
    bands.detail.reduce((n, b) => n + b.elements.length, 0) +
    bands.groups.reduce((n, g) => n + deBanda(g.header) + deBanda(g.footer), 0)
  );
}

export function AssistenteDrawer({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const [descricao, setDescricao] = useState('');
  const [refinar, setRefinar] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const templateAberto = useDocumentoStore((s) => s.template);

  const gerar = async () => {
    setGerando(true);
    setErro(null);
    setRascunho(null);
    try {
      const resposta = await fetch('/assist/gerar-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descricao,
          contrato: templateAberto?.dataContract ?? { fields: [], parameters: [], variables: [] },
          templateAtual: refinar && templateAberto ? templateAberto : undefined,
        }),
      });
      if (resposta.status === 503) {
        setErro('IA indisponível no momento (verifique a configuração do serviço de render). O designer segue funcionando normalmente.');
        return;
      }
      if (!resposta.ok) {
        const corpo = (await resposta.json().catch(() => null)) as { mensagem?: string } | null;
        setErro(corpo?.mensagem ?? `falha ao gerar (HTTP ${resposta.status}) — tente reformular a descrição`);
        return;
      }
      const corpo = (await resposta.json()) as RespostaDoAssistente;
      const template = normalizarDraft(corpo.template);
      // Validação obrigatória pós-geração (tarefa 2.4): mesma dupla do editor.
      setRascunho({ template, problemas: validarDocumento(template), observacoes: corpo.observacoes, modelo: corpo.modelo });
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setGerando(false);
    }
  };

  const carregar = () => {
    if (!rascunho) return;
    const store = useDocumentoStore.getState();
    if (store.template) {
      // Troca com UM commit: desfazer volta ao documento anterior.
      store.mutarTemplate(() => rascunho.template);
    } else {
      store.novoDocumento(rascunho.template);
    }
    setRascunho(null);
    onFechar();
  };

  return (
    <Drawer opened={aberto} onClose={onFechar} position="right" size={420} transitionProps={{ duration: 0 }} title={
      <Group gap={8}>
        <Text fw={600}>✨ Assistente de relatório</Text>
        <Badge size="xs" variant="light">beta</Badge>
      </Group>
    }>
      <Stack gap="sm">
        <Text size="xs" c="dimmed">
          Descreva o relatório em português; a IA devolve um rascunho já bindado a um contrato de
          dados — revise e carregue no editor. A descrição e o contrato (nomes/tipos, nunca dados de
          clientes) são enviados ao provedor de IA configurado (ADR-014).
        </Text>
        <Textarea
          aria-label="Descrição do relatório"
          placeholder="ex.: comprovante de entrega com cabeçalho da empresa, dados do cliente, lista de itens, área de assinatura e QR do pedido"
          rows={5}
          value={descricao}
          onChange={(e) => setDescricao(e.currentTarget.value)}
        />
        {templateAberto && (
          <Checkbox
            size="xs"
            label="Refinar o template aberto (em vez de gerar do zero)"
            checked={refinar}
            onChange={(e) => setRefinar(e.currentTarget.checked)}
          />
        )}
        <Button loading={gerando} disabled={!descricao.trim()} onClick={() => void gerar()}>
          Gerar rascunho
        </Button>

        {erro && (
          <Alert color="orange" p="xs" data-testid="assistente-erro">
            <Text size="xs">{erro}</Text>
          </Alert>
        )}

        {rascunho && (
          <Stack gap={6} data-testid="assistente-rascunho">
            <Group gap={6}>
              <Badge variant="light">{rascunho.template.name}</Badge>
              <Text size="xs" c="dimmed">
                {contarElementos(rascunho.template)} elemento(s) ·{' '}
                {rascunho.template.dataContract.fields.length} field(s) · modelo {rascunho.modelo}
              </Text>
            </Group>
            {rascunho.observacoes && <Text size="xs">{rascunho.observacoes}</Text>}
            {rascunho.problemas.length > 0 ? (
              <Alert color="yellow" p="xs" data-testid="assistente-problemas">
                <Text size="xs" fw={600}>
                  {rascunho.problemas.length} problema(s) de validação — o rascunho abre no editor com o
                  ReportChecker apontando cada um:
                </Text>
                {rascunho.problemas.slice(0, 5).map((p, i) => (
                  <Text size="xs" key={i}>
                    • [{p.code}] {p.message}
                  </Text>
                ))}
              </Alert>
            ) : (
              <Text size="xs" c="green">
                ✓ Rascunho válido (estrutura JRXML 7 + contrato)
              </Text>
            )}
            <Button variant="light" onClick={carregar} data-testid="assistente-carregar">
              Carregar rascunho no editor
            </Button>
          </Stack>
        )}
      </Stack>
    </Drawer>
  );
}
