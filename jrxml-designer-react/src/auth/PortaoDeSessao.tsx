/**
 * Portão da sessão (ADR-017 §6): sem sessão no modo autenticado, mostra
 * "Entrar" e NÃO monta o designer (nenhuma chamada à API sem token).
 */
import { Alert, Button, Center, Loader, Stack, Text, Title } from '@mantine/core';
import { useEffect, type ReactNode } from 'react';
import { useSessaoStore } from './authStore';

export function PortaoDeSessao({ children }: { children: ReactNode }) {
  const modo = useSessaoStore((s) => s.modo);
  const erro = useSessaoStore((s) => s.erro);
  const iniciar = useSessaoStore((s) => s.iniciar);
  const entrar = useSessaoStore((s) => s.entrar);

  useEffect(() => {
    if (useSessaoStore.getState().modo === 'carregando') {
      void iniciar();
    }
  }, [iniciar]);

  if (modo === 'dev' || modo === 'autenticado') {
    return <>{children}</>;
  }
  if (modo === 'carregando') {
    return (
      <Center h="100vh">
        <Loader size="sm" />
      </Center>
    );
  }
  return (
    <Center h="100vh">
      <Stack align="center" gap="sm" maw={420}>
        <Title order={3}>ReportLenz — Designer</Title>
        <Text size="sm" c="dimmed" ta="center">
          Entre com sua conta corporativa para editar e publicar templates.
        </Text>
        <Button onClick={() => void entrar()} data-testid="sessao-entrar">
          Entrar
        </Button>
        {erro && (
          <Alert color="red" p="xs" data-testid="sessao-erro">
            <Text size="xs">{erro}</Text>
          </Alert>
        )}
      </Stack>
    </Center>
  );
}

/** Usuário + sair no cabeçalho do designer (só quando autenticado). */
export function UsuarioDaSessao() {
  const modo = useSessaoStore((s) => s.modo);
  const usuario = useSessaoStore((s) => s.usuario);
  const sair = useSessaoStore((s) => s.sair);
  if (modo !== 'autenticado') return null;
  return (
    <>
      <Text size="xs" c="dimmed" data-testid="sessao-usuario">
        {usuario}
      </Text>
      <Button size="compact-xs" variant="subtle" onClick={() => void sair()}>
        Sair
      </Button>
    </>
  );
}
