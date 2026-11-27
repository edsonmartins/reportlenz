/**
 * Como o designer se integra à aplicação que o hospeda (ADR-025 §2): qual
 * codename usar no registro, que recursos mostrar e os eventos de salvar e
 * publicar. A SPA de homologação usa INTEGRACAO_DA_SPA (comportamento de
 * sempre); `<ReportLenzDesigner>` monta a sua a partir das props.
 */
import type { IntegrationPackage } from '@archbase/reportlenz-jrxml-core';
import { createContext, useContext, type ReactNode } from 'react';

export interface Recursos {
  /** Galeria de modelos quando não há documento aberto. */
  galeria: boolean;
  /** Assistente de IA (RFC-005). */
  assistente: boolean;
  /** Botão "Salvar" (cria/atualiza o draft no registro). */
  salvar: boolean;
  /** Publish Wizard (gates G1–G8). */
  publicar: boolean;
}

export interface EventoSalvo {
  codename: string;
  versao: number;
  /** false = o conteúdo já era o do draft existente (mesmo hash). */
  novaVersao: boolean;
  jrxmlHash: string;
}

export interface EventoPublicado {
  codename: string;
  versao: number;
  /** Pacote de integração da versão (RFC-002 §6): inputSchema, tipos TS e record Java. */
  pacoteDeIntegracao: IntegrationPackage;
}

export interface Integracao {
  /** Codename no registro; ausente = o nome do template. */
  codename?: string;
  recursos: Recursos;
  /** Ações da aplicação à direita da barra (ex.: usuário/sair na SPA). */
  acoesExtras?: ReactNode;
  /** A SPA baixa o pacote de integração ao publicar; embutido, ele vem no evento. */
  baixarPacoteDeIntegracao: boolean;
  onSalvo?: (evento: EventoSalvo) => void;
  onPublicado?: (evento: EventoPublicado) => void;
}

export const INTEGRACAO_DA_SPA: Integracao = {
  recursos: { galeria: true, assistente: true, salvar: false, publicar: true },
  baixarPacoteDeIntegracao: true,
};

const ContextoDeIntegracao = createContext<Integracao>(INTEGRACAO_DA_SPA);

export function ProvedorDeIntegracao({ valor, children }: { valor: Integracao; children: ReactNode }) {
  return <ContextoDeIntegracao.Provider value={valor}>{children}</ContextoDeIntegracao.Provider>;
}

export function useIntegracao(): Integracao {
  return useContext(ContextoDeIntegracao);
}

/** Codename efetivo no registro para o template aberto. */
export function codenameDoRegistro(integracao: Integracao, nomeDoTemplate: string): string {
  return integracao.codename ?? nomeDoTemplate;
}
