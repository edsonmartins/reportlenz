import { describe, expect, it } from 'vitest';
import { REFERENCIA_COMPROVANTE, buildIntegrationPackage, serializeJrxml, sha256 } from '../src/index.js';

/**
 * Testes das tarefas phase-1/3.4 (pacote de integração do Publish Wizard,
 * RFC-002 §6) e do sha256 puro que sustenta o jrxml_hash (ADR-009/G6).
 */

describe('jrxml-core · sha256 (jrxml_hash)', () => {
  it('bate com os vetores oficiais do FIPS 180-4', () => {
    expect(sha256('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    );
  });

  it('cobre UTF-8 multi-byte (acentuação pt-BR e emoji)', () => {
    // sha256("ação") — referência gerada por implementação canônica
    expect(sha256('ação')).toHaveLength(64);
    expect(sha256('ação')).not.toBe(sha256('acao'));
    expect(sha256('🚀')).toHaveLength(64);
    // Determinístico
    expect(sha256('ação')).toBe(sha256('ação'));
  });
});

describe('jrxml-core · buildIntegrationPackage (3.4, RFC-002 §6)', () => {
  const pacote = buildIntegrationPackage(REFERENCIA_COMPROVANTE, { version: 3, baseUrl: 'https://render.rioquality.com.br' });

  it('registro: nome, versão, jrxml_hash (G6) e contrato', () => {
    expect(pacote.registro.templateName).toBe('comprovante_entrega');
    expect(pacote.registro.version).toBe(3);
    expect(pacote.registro.inputSchemaId).toBe('reportlenz:contract:comprovante_entrega:v3');
    // G6 — hash consistente: é o sha256 do JRXML publicado (mesma chave do compile cache)
    expect(pacote.registro.jrxmlHash).toBe(sha256(serializeJrxml(REFERENCIA_COMPROVANTE)));
    expect(pacote.registro.jrxmlHash).toMatch(/^[0-9a-f]{64}$/);
    expect(pacote.registro.contract.fields.length).toBeGreaterThan(0);
  });

  it('artefatos completos e coerentes entre si', () => {
    expect(pacote.jrxml).toContain('<jasperReport name="comprovante_entrega"');
    expect(pacote.inputSchema.$id).toBe('reportlenz:contract:comprovante_entrega:v3');
    expect(pacote.tsTypes).toContain('export interface ComprovanteEntregaPayload');
    expect(pacote.javaRecord).toContain('public record ComprovanteEntregaPayload(');
    expect(pacote.javaRecord).toContain('package dev.reportlenz.contrato;');
  });

  it('snippet Java aponta para o serviço com o record gerado e a versão certa', () => {
    expect(pacote.javaSnippet).toContain('new ComprovanteEntregaPayload(');
    expect(pacote.javaSnippet).toContain('https://render.rioquality.com.br/render/preview');
    expect(pacote.javaSnippet).toContain('https://render.rioquality.com.br/render/batch');
    expect(pacote.javaSnippet).toContain('"version", 3');
    expect(pacote.javaSnippet).toContain('idempotencyKey');
  });

  it('nenhum artefato contém caminho de Pull (spec data-contract)', () => {
    const tudo = JSON.stringify(pacote);
    expect(tudo).not.toMatch(/queryString|jdbc|<query/i);
  });

  it('hash muda quando o template muda (integridade do G6)', () => {
    const outraVersao = buildIntegrationPackage(
      { ...REFERENCIA_COMPROVANTE, properties: { ...REFERENCIA_COMPROVANTE.properties, mudou: 'sim' } },
      { version: 4 },
    );
    expect(outraVersao.registro.jrxmlHash).not.toBe(pacote.registro.jrxmlHash);
  });
});
