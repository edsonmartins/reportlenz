/**
 * SPA de homologação (RFC-004 §2): casca com o cabeçalho do produto em volta
 * da área de trabalho do designer. Sessão OIDC própria (ADR-017) — o usuário
 * e "Sair" entram como ações extras da barra.
 */
import { AppShell, Badge, Group, Title } from '@mantine/core';
import { UsuarioDaSessao } from './auth/PortaoDeSessao';
import { AreaDeTrabalho } from './designer/AreaDeTrabalho';
import { INTEGRACAO_DA_SPA, ProvedorDeIntegracao } from './designer/integracao';

const INTEGRACAO = { ...INTEGRACAO_DA_SPA, acoesExtras: <UsuarioDaSessao /> };

export function App() {
  return (
    <AppShell header={{ height: 48 }} padding={0}>
      <AppShell.Header>
        <Group h="100%" px="md" gap="xs">
          <Title order={4}>ReportLenz</Title>
          <Badge variant="light">designer</Badge>
        </Group>
      </AppShell.Header>
      <AppShell.Main style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px)' }}>
        <ProvedorDeIntegracao valor={INTEGRACAO}>
          <AreaDeTrabalho />
        </ProvedorDeIntegracao>
      </AppShell.Main>
    </AppShell>
  );
}
