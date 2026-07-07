import { describe, expect, it } from 'vitest';
import { JRXML_DIALECT_TARGET } from '../src/index.js';

// Teste de fumaça do scaffold: garante que build/test estão ligados ao entry point.
describe('jrxml-core · scaffold', () => {
  it('expõe o dialeto-alvo JRXML 7.0.7 (ADR-002)', () => {
    expect(JRXML_DIALECT_TARGET).toBe('7.0.7');
  });
});
