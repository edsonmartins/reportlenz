/**
 * Expression editor (RFC-004 §5, tarefas phase-3/1.1-1.3): input com
 * autocomplete sobre o contrato (`$F{`/`$P{`/`$V{`), funções do
 * jasperreports-functions e validação inline (sintaxe + nomes) — o erro
 * definitivo continua indo ao ReportChecker no commit (validação contínua).
 */
import { Paper, Text, TextInput, UnstyledButton } from '@mantine/core';
import type { KeyboardEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { GerarExpressaoIA } from './GerarExpressaoIA';
import type { EscopoDeExpressao, Sugestao } from './sugestoes';
import { aplicarSugestao, contextoDoCursor, sugestoesPara, validarExpressaoInline } from './sugestoes';

interface ExpressionEditorProps {
  valor: string;
  escopo: EscopoDeExpressao;
  onCommit: (novo: string) => void;
  'aria-label'?: string;
  placeholder?: string;
  herdado?: boolean;
}

export function ExpressionEditor({ valor, escopo, onCommit, herdado, ...props }: ExpressionEditorProps) {
  const [texto, setTexto] = useState(valor);
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [ativa, setAtiva] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const contextoRef = useRef<ReturnType<typeof contextoDoCursor>>(null);

  useEffect(() => {
    setTexto(valor);
  }, [valor]);

  const problemas = validarExpressaoInline(texto, escopo);

  const atualizar = (novoTexto: string, cursor: number) => {
    setTexto(novoTexto);
    const contexto = contextoDoCursor(novoTexto, cursor);
    contextoRef.current = contexto;
    setSugestoes(sugestoesPara(contexto, escopo));
    setAtiva(0);
  };

  const escolher = (sugestao: Sugestao) => {
    const contexto = contextoRef.current;
    const cursor = inputRef.current?.selectionStart ?? texto.length;
    if (!contexto) return;
    const resultado = aplicarSugestao(texto, cursor, contexto, sugestao);
    atualizar(resultado.texto, resultado.cursor);
    // devolve o foco e o cursor ao input
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(resultado.cursor, resultado.cursor);
    });
  };

  const aoTeclar = (e: KeyboardEvent<HTMLInputElement>) => {
    if (sugestoes.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setAtiva((a) => (a + 1) % sugestoes.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setAtiva((a) => (a - 1 + sugestoes.length) % sugestoes.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const s = sugestoes[ativa];
        if (s) escolher(s);
        return;
      }
      if (e.key === 'Escape') {
        setSugestoes([]);
        return;
      }
    } else if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  return (
    <div style={{ position: 'relative' }} data-testid="expression-editor">
      <TextInput
        ref={inputRef}
        size="xs"
        value={texto}
        error={problemas.length > 0}
        onChange={(e) => atualizar(e.currentTarget.value, e.currentTarget.selectionStart ?? e.currentTarget.value.length)}
        onKeyDown={aoTeclar}
        onBlur={() => {
          setSugestoes([]);
          if (texto !== valor) onCommit(texto);
        }}
        styles={herdado ? { input: { color: 'var(--mantine-color-gray-5)' } } : undefined}
        rightSection={
          <GerarExpressaoIA
            escopo={escopo}
            onUsar={(expressao) => {
              setTexto(expressao);
              onCommit(expressao);
            }}
          />
        }
        {...props}
      />

      {problemas.length > 0 && (
        <Text size="xs" c="red.7" data-testid="expressao-problema">
          {problemas[0]?.mensagem}
        </Text>
      )}

      {sugestoes.length > 0 && (
        <Paper
          withBorder
          shadow="md"
          data-testid="sugestoes"
          style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30, maxHeight: 220, overflowY: 'auto' }}
        >
          {sugestoes.map((s, i) => (
            <UnstyledButton
              key={s.rotulo}
              data-testid={`sugestao-${i}`}
              data-ativa={i === ativa || undefined}
              onMouseDown={(e) => {
                e.preventDefault(); // não tira o foco do input (blur commitaria antes)
                escolher(s);
              }}
              px={8}
              py={3}
              style={{
                display: 'block',
                width: '100%',
                background: i === ativa ? 'var(--mantine-color-blue-0)' : undefined,
              }}
            >
              <Text size="xs" span fw={600}>
                {s.rotulo}
              </Text>{' '}
              <Text size="xs" span c="dimmed">
                {s.detalhe}
              </Text>
            </UnstyledButton>
          ))}
        </Paper>
      )}
    </div>
  );
}
