import { MantineProvider } from '@mantine/core';
import '@mantine/core/styles.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Spa } from './spa/Spa';
import { PortaoDeSessao } from './auth/PortaoDeSessao';

const raiz = document.getElementById('root');
if (!raiz) {
  throw new Error('elemento #root ausente no index.html');
}

createRoot(raiz).render(
  <StrictMode>
    <MantineProvider defaultColorScheme="light">
      <PortaoDeSessao>
        <Spa />
      </PortaoDeSessao>
    </MantineProvider>
  </StrictMode>,
);
