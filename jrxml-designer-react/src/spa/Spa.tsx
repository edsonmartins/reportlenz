/**
 * SPA de homologação (ADR-025 §1): CONSUMIDORA da API pública do pacote,
 * exatamente como uma aplicação da empresa faria — o E2E da SPA testa o
 * componente. A sessão OIDC (ADR-017) é da SPA: o token vai por
 * `getAccessToken`, o 401 volta ao "Entrar" e o usuário/"Sair" entram como
 * ações extras.
 */
import { AppShell, Badge, Group, Title } from '@mantine/core';
import { UsuarioDaSessao } from '../auth/PortaoDeSessao';
import { useSessaoStore } from '../auth/authStore';
import { ReportLenzDesigner, type EventoPublicado } from '../index';

/** A SPA mantém o comportamento de sempre: baixa o pacote de integração ao publicar. */
function baixarPacoteDeIntegracao({ versao, pacoteDeIntegracao }: EventoPublicado) {
  const blob = new Blob([JSON.stringify(pacoteDeIntegracao, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${pacoteDeIntegracao.registro.templateName}-v${versao}.reportlenz.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function Spa() {
  return (
    <AppShell header={{ height: 48 }} padding={0}>
      <AppShell.Header>
        <Group h="100%" px="md" gap="xs">
          <Title order={4}>ReportLenz</Title>
          <Badge variant="light">designer</Badge>
        </Group>
      </AppShell.Header>
      <AppShell.Main style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px)' }}>
        <ReportLenzDesigner
          getAccessToken={() => useSessaoStore.getState().accessToken}
          onNaoAutorizado={() => useSessaoStore.getState().sessaoExpirada()}
          acoesExtras={<UsuarioDaSessao />}
          recursos={{ salvar: false }}
          onPublicado={baixarPacoteDeIntegracao}
        />
      </AppShell.Main>
    </AppShell>
  );
}
