/**
 * Instância do designer (ADR-025 §3, change componente-embutivel/2.1).
 *
 * Cada `<ReportLenzDesigner>` tem a SUA instância — documento, canvas,
 * preview e cliente de API ligados entre si — entregue por contexto. Duas
 * instâncias na mesma página são independentes.
 *
 * Fora de um provider vale a instância PADRÃO (criada sob demanda): a SPA de
 * homologação e os testes de componente usam os hooks como sempre, e
 * `useDocumentoStore.getState()` estático continua apontando para ela.
 */
import { createContext, useContext, type ReactNode } from 'react';
import { useStore, type StoreApi } from 'zustand';
import { clientePadrao, type ClienteDaApi } from './api/cliente';
import { criarPreviewStore, type PreviewState } from './preview/previewStore';
import { criarCanvasStore, type CanvasState } from './store/canvasStore';
import { criarDocumentoStore, type DocumentoState } from './store/documentoStore';

export interface InstanciaDoDesigner {
  documento: StoreApi<DocumentoState>;
  canvas: StoreApi<CanvasState>;
  preview: StoreApi<PreviewState>;
  api: ClienteDaApi;
}

export function criarInstanciaDoDesigner(opcoes: { api?: ClienteDaApi } = {}): InstanciaDoDesigner {
  const api = opcoes.api ?? clientePadrao;
  const documento = criarDocumentoStore();
  return { documento, canvas: criarCanvasStore(), preview: criarPreviewStore(documento, api), api };
}

let padrao: InstanciaDoDesigner | undefined;

/** Instância usada fora de um provider (SPA standalone e testes). Criada sob demanda. */
export function obterInstanciaPadrao(): InstanciaDoDesigner {
  padrao ??= criarInstanciaDoDesigner();
  return padrao;
}

const ContextoDaInstancia = createContext<InstanciaDoDesigner | null>(null);

export function ProvedorDeInstancia({ instancia, children }: { instancia: InstanciaDoDesigner; children: ReactNode }) {
  return <ContextoDaInstancia.Provider value={instancia}>{children}</ContextoDaInstancia.Provider>;
}

/** A instância do designer onde o componente está (ou a padrão). */
export function useInstancia(): InstanciaDoDesigner {
  return useContext(ContextoDaInstancia) ?? obterInstanciaPadrao();
}

/**
 * Hook de store ciente da instância, com `getState`/`setState`/`subscribe`
 * estáticos sobre a instância PADRÃO (compatibilidade com a SPA e os testes).
 * Declaração de função (não const): é içada, o que torna seguro o ciclo de
 * import entre este módulo e os stores.
 */
export function hookDoStore<S>(escolher: (i: InstanciaDoDesigner) => StoreApi<S>) {
  function useStoreDaInstancia<T>(seletor: (s: S) => T): T {
    return useStore(escolher(useInstancia()), seletor);
  }
  const daPadrao = () => escolher(obterInstanciaPadrao());
  return Object.assign(useStoreDaInstancia, {
    getState: (): S => daPadrao().getState(),
    setState: ((...args: Parameters<StoreApi<S>['setState']>) => daPadrao().setState(...args)) as StoreApi<S>['setState'],
    subscribe: (ouvinte: Parameters<StoreApi<S>['subscribe']>[0]) => daPadrao().subscribe(ouvinte),
  });
}
