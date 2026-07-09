import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import type { DataContract } from '../src/index.js';
import { buildInputSchema, genJavaRecord, genTypeScriptTypes } from '../src/index.js';

/**
 * Testes da tarefa phase-1/3.3 (RFC-002 §4) — cenário 'Geração de artefatos':
 * interfaces TS COMPILÁVEIS (verificado com o compilador TypeScript real, em
 * memória, modo strict) e record(s) Java (estrutura aqui; compilação real com
 * javac roda no fluxo do harness/CI sobre os templates de referência).
 */

const CONTRATO: DataContract = {
  fields: [
    { name: 'pedido.numero', type: 'string', required: true },
    { name: 'pedido.data', type: 'date', required: true },
    { name: 'cliente.nome', type: 'string', required: true },
    { name: 'cliente.endereco', type: 'string' },
    {
      name: 'itens',
      type: 'collection',
      required: true,
      itemFields: [
        { name: 'descricao', type: 'string', required: true },
        { name: 'quantidade', type: 'decimal', required: true },
      ],
    },
    { name: 'ativo', type: 'boolean' },
  ],
  parameters: [{ name: 'titulo', type: 'string', description: 'Título do relatório' }],
  variables: [],
};

const SCHEMA = buildInputSchema(CONTRATO, { templateName: 'comprovante', version: 2 });

/** Compila fonte TS em memória (strict) e retorna os diagnósticos. */
function compilarTs(codigo: string): readonly ts.Diagnostic[] {
  const nomeArquivo = 'gerado.ts';
  const opcoes: ts.CompilerOptions = {
    strict: true,
    noEmit: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
  };
  const host = ts.createCompilerHost(opcoes);
  const original = host.getSourceFile.bind(host);
  host.getSourceFile = (nome, versaoLinguagem, ...resto) =>
    nome === nomeArquivo
      ? ts.createSourceFile(nomeArquivo, codigo, ts.ScriptTarget.ES2022, true)
      : original(nome, versaoLinguagem, ...resto);
  host.fileExists = (nome) => nome === nomeArquivo || ts.sys.fileExists(nome);
  host.readFile = (nome) => (nome === nomeArquivo ? codigo : ts.sys.readFile(nome));

  const programa = ts.createProgram([nomeArquivo], opcoes, host);
  const sf = programa.getSourceFile(nomeArquivo);
  return [...programa.getSyntacticDiagnostics(sf), ...programa.getSemanticDiagnostics(sf)];
}

describe('jrxml-core · genTypeScriptTypes (3.3)', () => {
  const codigo = genTypeScriptTypes(SCHEMA, { rootName: 'ComprovantePayload' });

  it('gera interfaces compiláveis em modo strict (compilador real)', () => {
    const diagnosticos = compilarTs(codigo);
    expect(diagnosticos.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))).toEqual([]);
  });

  it('as interfaces tipam de verdade: payload válido compila, inválido não', () => {
    const valido = `
      const p: ComprovantePayload = {
        pedido: { numero: 'P-1', data: '2026-07-09' },
        cliente: { nome: 'Açougue São João' },
        itens: [{ descricao: 'Linguiça', quantidade: 12.5 }],
      };
      void p;`;
    expect(compilarTs(codigo + valido)).toEqual([]);

    const invalido = `
      const p: ComprovantePayload = {
        pedido: { numero: 'P-1', data: '2026-07-09' },
        cliente: { nome: 'X' },
        itens: [{ descricao: 'Linguiça', quantidade: 'doze' }],
      };
      void p;`;
    expect(compilarTs(codigo + invalido).length).toBeGreaterThan(0);
  });

  it('estrutura: agrupamento vira interface nomeada; opcionalidade respeita o required', () => {
    expect(codigo).toContain('export interface ComprovantePayload {');
    expect(codigo).toContain('pedido: Pedido;');
    expect(codigo).toContain('cliente: Cliente;');
    expect(codigo).toContain('itens: ItensItem[];');
    expect(codigo).toContain('titulo?: string;');
    expect(codigo).toContain('endereco?: string;');
    expect(codigo).toContain('ativo?: boolean;');
    expect(codigo).toContain('/** Título do relatório */');
    expect(codigo).toContain('reportlenz:contract:comprovante:v2');
  });
});

describe('jrxml-core · genJavaRecord (3.3)', () => {
  const codigo = genJavaRecord(SCHEMA, { rootName: 'ComprovantePayload', packageName: 'dev.reportlenz.contrato' });

  it('gera record raiz público com aninhados dentro (um arquivo autocontido)', () => {
    expect(codigo).toContain('package dev.reportlenz.contrato;');
    expect(codigo).toContain('public record ComprovantePayload(');
    expect(codigo).toContain('public record Pedido(String numero, java.time.LocalDate data)');
    expect(codigo).toContain('public record Cliente(String nome, String endereco)');
    expect(codigo).toContain('public record ItensItem(String descricao, java.math.BigDecimal quantidade)');
    expect(codigo).toContain('java.util.List<ItensItem> itens');
    expect(codigo).toContain('Boolean ativo');
  });

  it('nunca gera nada de Pull (sem query/conexão)', () => {
    expect(codigo).not.toMatch(/query|sql|jdbc|connection/i);
  });
});
