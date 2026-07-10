import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Sem globals do vitest, o auto-cleanup do Testing Library não se registra.
afterEach(() => {
  cleanup();
});

// Polyfills exigidos pelo Mantine em jsdom.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = window.ResizeObserver ?? ResizeObserverStub;

// jsdom não implementa object URLs (preview usa p/ o PNG do render).
if (typeof URL.createObjectURL !== 'function') {
  let contador = 0;
  URL.createObjectURL = () => `blob:mock-${contador++}`;
  URL.revokeObjectURL = () => {};
}
