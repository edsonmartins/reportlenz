/**
 * Aplicação hospedeira de TESTE (ADR-025, change componente-embutivel/3.3):
 * usa SÓ a API pública dos pacotes publicados, como uma aplicação da empresa.
 *
 * - Designer A: modo CONTROLADO (a aplicação guarda o JRXML);
 * - Designer B: modo REGISTRO (abre um template publicado por codename);
 * - Preview: o template publicado com dados da aplicação.
 *
 * O render-service fica em OUTRA origem (VITE_REPORTLENZ_API, default
 * http://localhost:8080) → exercita CORS. O token vem da "sessão" da
 * aplicação; aqui, injetado pelo E2E em window.__REPORTLENZ_TOKEN__.
 */
import '@mantine/core/styles.css';
import { Badge, Group, MantineProvider, Text, Title } from '@mantine/core';
import { ReportLenzDesigner, ReportLenzPreview } from '@reportlenz/designer-react';
import { REFERENCIA_FATURA, serializeJrxml } from '@reportlenz/jrxml-core';
import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';

declare global {
  interface Window {
    __REPORTLENZ_TOKEN__?: string;
  }
}

const API = (import.meta.env.VITE_REPORTLENZ_API as string | undefined) ?? 'http://localhost:8080';
const token = () => window.__REPORTLENZ_TOKEN__ ?? null;

function Hospedeiro() {
  const [jrxml, setJrxml] = useState(() => serializeJrxml(REFERENCIA_FATURA));
  const [mudancas, setMudancas] = useState(0);
  const [eventos, setEventos] = useState<string[]>([]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 8 }}>
      <Group>
        <Title order={4}>Aplicação hospedeira de teste</Title>
        <Badge data-testid="mudancas-a">{mudancas} mudança(s) no designer A</Badge>
        <Text size="xs" data-testid="eventos">
          {eventos.join(' · ')}
        </Text>
      </Group>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, height: '62vh' }}>
        <div data-testid="host-a" style={{ border: '1px solid #ddd', minHeight: 0 }}>
          <ReportLenzDesigner
            apiBaseUrl={API}
            getAccessToken={token}
            template={jrxml}
            onChange={(_modelo, novo) => {
              setJrxml(novo);
              setMudancas((n) => n + 1);
            }}
          />
        </div>
        <div data-testid="host-b" style={{ border: '1px solid #ddd', minHeight: 0 }}>
          <ReportLenzDesigner
            apiBaseUrl={API}
            getAccessToken={token}
            codename="formulario_cadastro"
            onSalvo={(e) => setEventos((ev) => [...ev, `salvo v${e.versao}`])}
          />
        </div>
      </div>
      <div data-testid="host-preview" style={{ border: '1px solid #ddd', height: '70vh' }}>
        <ReportLenzPreview
          apiBaseUrl={API}
          getAccessToken={token}
          codename="formulario_cadastro"
          payload={{ titulo_ficha: 'Ficha da aplicação hospedeira', nome: 'Maria Hospedeira', documento: '123.456.789-00', nascimento: '1990-12-01', ativo: true }}
        />
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider>
      <Hospedeiro />
    </MantineProvider>
  </StrictMode>,
);
