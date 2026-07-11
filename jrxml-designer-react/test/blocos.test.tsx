import { MantineProvider } from '@mantine/core';
import type { ReportTemplate } from '@reportlenz/jrxml-core';
import { REFERENCIA_FATURA, serializeJrxml } from '@reportlenz/jrxml-core';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from '../src/App';
import { BIBLIOTECA_DE_BLOCOS } from '../src/blocos/biblioteca';
import { mesclarMiniContrato, reescreverExpressao } from '../src/blocos/mesclarContrato';
import { inserirBloco } from '../src/store/mutacoes';
import { useCanvasStore } from '../src/store/canvasStore';
import { useDocumentoStore, validarDocumento } from '../src/store/documentoStore';

/**
 * Fase 3, bloco 8 — biblioteca de blocos reutilizáveis (8.1) e mescla do
 * mini-contrato ao contrato do template com conflito de nomes (8.2).
 */

const bloco = (id: string) => {
  const b = BIBLIOTECA_DE_BLOCOS.find((x) => x.id === id);
  if (!b) throw new Error(`bloco ${id} não existe`);
  return b;
};

describe('mesclarMiniContrato (8.2)', () => {
  it('nomes livres são adicionados; declaração idêntica é reaproveitada sem duplicar', () => {
    const fatura = structuredClone(REFERENCIA_FATURA);
    const primeira = mesclarMiniContrato(fatura.dataContract, bloco('rodape-com-totais').miniContrato);
    expect(primeira.contrato.fields.some((f) => f.name === 'valor' && f.type === 'decimal')).toBe(true);
    expect(primeira.contrato.variables.some((v) => v.name === 'total_geral')).toBe(true);
    expect(primeira.renomeios).toEqual({ F: {}, P: {}, V: {} });
    expect(primeira.avisos).toEqual([]);

    // Mesclar o MESMO bloco de novo: tudo compatível → reaproveita, nada duplica.
    const segunda = mesclarMiniContrato(primeira.contrato, bloco('rodape-com-totais').miniContrato);
    expect(segunda.contrato.fields.filter((f) => f.name === 'valor')).toHaveLength(1);
    expect(segunda.contrato.variables.filter((v) => v.name === 'total_geral')).toHaveLength(1);
    expect(segunda.renomeios).toEqual({ F: {}, P: {}, V: {} });
    expect(segunda.avisos.length).toBeGreaterThan(0);
  });

  it('conflito de nomes renomeia com sufixo e reescreve as expressões dependentes', () => {
    const contrato = structuredClone(REFERENCIA_FATURA.dataContract);
    contrato.fields.push({ name: 'valor', type: 'string' }); // tipo INCOMPATÍVEL com o exigido (decimal)
    contrato.variables.push({ name: 'total_geral', type: 'integer', calculation: 'Count', expression: '$F{categoria}' });

    const { contrato: mesclado, renomeios, avisos } = mesclarMiniContrato(contrato, bloco('rodape-com-totais').miniContrato);

    expect(renomeios.F.valor).toBe('valor_2');
    expect(renomeios.V.total_geral).toBe('total_geral_2');
    expect(mesclado.fields.some((f) => f.name === 'valor_2' && f.type === 'decimal')).toBe(true);
    // A variável do bloco entra renomeada E somando o campo renomeado.
    const varDoBloco = mesclado.variables.find((v) => v.name === 'total_geral_2');
    expect(varDoBloco?.expression).toBe('$F{valor_2}');
    expect(avisos).toHaveLength(2);

    // Reescrita das expressões do bloco segue os renomeios (demais nomes intactos).
    expect(reescreverExpressao('$V{total_geral} + $F{valor} + $F{categoria}', renomeios)).toBe(
      '$V{total_geral_2} + $F{valor_2} + $F{categoria}',
    );
  });
});

describe('inserirBloco (8.1)', () => {
  it('todos os blocos da biblioteca inserem na fatura mantendo o documento válido (G3)', () => {
    for (const b of BIBLIOTECA_DE_BLOCOS) {
      const { template, selecao } = inserirBloco(structuredClone(REFERENCIA_FATURA), b);
      expect(validarDocumento(template), b.id).toEqual([]);
      expect(selecao).toHaveLength(b.elementos.length);
    }
  });

  it('cria a banda de destino quando não existe (summary) e estica quando baixa', () => {
    const semSummary: ReportTemplate = structuredClone(REFERENCIA_FATURA);
    delete semSummary.bands.summary;

    const assinatura = bloco('bloco-assinatura');
    const { template } = inserirBloco(semSummary, assinatura);
    expect(template.bands.summary?.height).toBe(assinatura.alturaMinimaPt);
    expect(template.bands.summary?.elements).toHaveLength(assinatura.elementos.length);
    expect(validarDocumento(template)).toEqual([]);
  });

  it('QR de pedido: barcode bindado a $F{pedido.qrPayload} com o campo mesclado (cenário da spec)', () => {
    const { template } = inserirBloco(structuredClone(REFERENCIA_FATURA), bloco('qr-de-pedido'));
    const qr = template.bands.detail[0]?.elements.at(-1);
    expect(qr?.kind === 'barcode' && qr.expression).toBe('$F{pedido.qrPayload}');
    expect(template.dataContract.fields.some((f) => f.name === 'pedido.qrPayload')).toBe(true);
    expect(serializeJrxml(template)).toContain('$F{pedido.qrPayload}');
  });

  it('em conflito, os elementos inseridos usam os nomes renomeados (JRXML coerente)', () => {
    const comConflito: ReportTemplate = structuredClone(REFERENCIA_FATURA);
    comConflito.dataContract.fields.push({ name: 'valor', type: 'string' });
    comConflito.dataContract.variables.push({ name: 'total_geral', type: 'integer', calculation: 'Count', expression: '$F{categoria}' });

    const { template, avisos } = inserirBloco(comConflito, bloco('rodape-com-totais'));
    const totalizador = template.bands.summary?.elements.at(-1);
    expect(totalizador?.kind === 'textField' && totalizador.expression).toBe('$V{total_geral_2}');
    expect(avisos).toHaveLength(2);
    expect(validarDocumento(template)).toEqual([]);
  });
});

describe('blocos versionados e avisos visíveis (Fase 4, bloco 6)', () => {
  it('6.1: todo bloco tem versão e a inserção carimba a proveniência no JRXML', () => {
    expect(BIBLIOTECA_DE_BLOCOS.every((b) => b.versao >= 1)).toBe(true);

    const { template } = inserirBloco(structuredClone(REFERENCIA_FATURA), bloco('cabecalho-timbrado'));
    expect(template.properties['reportlenz.bloco.cabecalho-timbrado']).toBe('1');
    // Proveniência sobrevive à serialização — auditável no JRXML publicado.
    expect(serializeJrxml(template)).toContain('reportlenz.bloco.cabecalho-timbrado');
    expect(validarDocumento(template)).toEqual([]);
  });

  it('6.2: conflito na mescla fica VISÍVEL na UI (alert com os renomeios)', () => {
    const comConflito = structuredClone(REFERENCIA_FATURA);
    comConflito.dataContract.fields.push({ name: 'valor', type: 'string' });
    useDocumentoStore.getState().fecharDocumento();
    useCanvasStore.setState({ zoom: 1, mostrarGrid: false, passoGridMm: 5, snapAtivo: false, guiasDeSnap: null });
    useDocumentoStore.getState().novoDocumento(comConflito);

    render(
      <MantineProvider>
        <App />
      </MantineProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: '+ Inserir' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rodapé com totais' }));

    const alerta = screen.getByTestId('avisos-de-bloco');
    expect(alerta.textContent).toContain('valor_2');
    expect(useDocumentoStore.getState().problemas).toEqual([]);

    // Dispensável pelo usuário.
    fireEvent.click(within(alerta).getByRole('button'));
    expect(screen.queryByTestId('avisos-de-bloco')).not.toBeInTheDocument();
  });
});

describe('menu "+ Inserir" · grupo Blocos', () => {
  beforeEach(() => {
    useDocumentoStore.getState().fecharDocumento();
    useCanvasStore.setState({ zoom: 1, mostrarGrid: false, passoGridMm: 5, snapAtivo: false, guiasDeSnap: null });
    useDocumentoStore.getState().novoDocumento(structuredClone(REFERENCIA_FATURA));
  });

  it('inserir "Cabeçalho timbrado" mescla os parâmetros e seleciona os elementos colados', () => {
    render(
      <MantineProvider>
        <App />
      </MantineProvider>,
    );
    const antes = useDocumentoStore.getState().template!.bands.pageHeader!.elements.length;

    fireEvent.click(screen.getByRole('button', { name: '+ Inserir' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Cabeçalho timbrado' }));

    const estado = useDocumentoStore.getState();
    expect(estado.template?.bands.pageHeader?.elements.length).toBe(antes + 4);
    expect(estado.template?.dataContract.parameters.some((p) => p.name === 'empresa_nome')).toBe(true);
    expect(estado.selecao).toHaveLength(4);
    expect(estado.problemas).toEqual([]);
  });
});
