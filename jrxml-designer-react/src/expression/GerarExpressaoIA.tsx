/**
 * Assistente B — NL → expressão JR (Fase 4, RFC-005 §3, tarefas 3.1-3.2).
 * Botão ✨ acoplado ao ExpressionEditor: o pedido em português vai com o
 * VOCABULÁRIO do escopo atual (master ou dataset da tabela); a expressão
 * volta e é validada por validarExpressaoInline ANTES do "Usar" — depois do
 * commit, a validação contínua/ReportChecker seguem valendo (IA não fura gates).
 */
import { ActionIcon, Alert, Button, Code, Popover, Stack, Text, Textarea, Tooltip } from '@mantine/core';
import { useState } from 'react';
import type { EscopoDeExpressao } from './sugestoes';
import { validarExpressaoInline } from './sugestoes';

interface GerarExpressaoIAProps {
  escopo: EscopoDeExpressao;
  onUsar: (expressao: string) => void;
}

interface Sugerida {
  expressao: string;
  explicacao: string;
  problemas: string[];
}

export function GerarExpressaoIA({ escopo, onUsar }: GerarExpressaoIAProps) {
  const [aberto, setAberto] = useState(false);
  const [pedido, setPedido] = useState('');
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sugerida, setSugerida] = useState<Sugerida | null>(null);

  const gerar = async () => {
    setGerando(true);
    setErro(null);
    setSugerida(null);
    try {
      const resposta = await fetch('/assist/gerar-expressao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descricao: pedido, escopo }),
      });
      if (resposta.status === 503) {
        setErro('IA indisponível — digite a expressão manualmente (autocomplete continua ativo).');
        return;
      }
      if (!resposta.ok) {
        const corpo = (await resposta.json().catch(() => null)) as { mensagem?: string } | null;
        setErro(corpo?.mensagem ?? `falha ao gerar (HTTP ${resposta.status})`);
        return;
      }
      const corpo = (await resposta.json()) as { expressao: string; explicacao: string };
      if (!corpo.expressao) {
        setErro(corpo.explicacao || 'a IA não conseguiu montar a expressão com o vocabulário atual');
        return;
      }
      // Validação obrigatória pós-geração (3.2): mesma régua do editor.
      const problemas = validarExpressaoInline(corpo.expressao, escopo).map((p) => p.mensagem);
      setSugerida({ expressao: corpo.expressao, explicacao: corpo.explicacao, problemas });
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    } finally {
      setGerando(false);
    }
  };

  const usar = () => {
    if (!sugerida) return;
    onUsar(sugerida.expressao);
    setAberto(false);
    setSugerida(null);
    setPedido('');
  };

  return (
    <Popover opened={aberto} onChange={setAberto} width={340} position="bottom-end" withArrow
      transitionProps={{ duration: 0 }}>
      <Popover.Target>
        <Tooltip label="Gerar a expressão descrevendo em português (Assistente de IA)">
          <ActionIcon size="sm" variant="subtle" color="violet" aria-label="gerar expressão com IA"
            onClick={() => setAberto((v) => !v)}>
            ✨
          </ActionIcon>
        </Tooltip>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap={6}>
          <Textarea
            size="xs"
            rows={2}
            aria-label="Pedido da expressão"
            placeholder="ex.: total do item = quantidade vezes preço unitário"
            value={pedido}
            onChange={(e) => setPedido(e.currentTarget.value)}
          />
          <Button size="compact-xs" loading={gerando} disabled={!pedido.trim()} onClick={() => void gerar()}>
            Gerar
          </Button>
          {erro && (
            <Alert color="orange" p={6} data-testid="expressao-ia-erro">
              <Text size="xs">{erro}</Text>
            </Alert>
          )}
          {sugerida && (
            <Stack gap={4} data-testid="expressao-ia-sugerida">
              <Code block>{sugerida.expressao}</Code>
              {sugerida.explicacao && (
                <Text size="xs" c="dimmed">
                  {sugerida.explicacao}
                </Text>
              )}
              {sugerida.problemas.length > 0 && (
                <Alert color="yellow" p={6} data-testid="expressao-ia-problemas">
                  <Text size="xs">{sugerida.problemas[0]}</Text>
                </Alert>
              )}
              <Button size="compact-xs" variant="light" onClick={usar} data-testid="expressao-ia-usar">
                Usar esta expressão
              </Button>
            </Stack>
          )}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
