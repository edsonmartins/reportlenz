import { validateContract } from '@reportlenz/jrxml-core';
import { describe, expect, it } from 'vitest';
import { PRESETS_DE_ELEMENTO } from '../src/palette/inserir';
import { useDocumentoStore } from '../src/store/documentoStore';

/** ADR-020: a paleta insere a sintaxe repo: e o checker aponta até virar um codename válido. */
describe('jrxml-designer-react · subreport por codename (ADR-020)', () => {
  it('preset da paleta usa o literal "repo:" e é apontado só como referência a ajustar', () => {
    const preset = PRESETS_DE_ELEMENTO.find((p) => p.criar().kind === 'subreport');
    expect(preset).toBeDefined();
    const el = preset!.criar();
    expect(el.kind === 'subreport' && el.templateExpression).toBe('"repo:codename_publicado"');

    useDocumentoStore.getState().novoDocumento({
      name: 'mestre',
      properties: {},
      pageFormat: { pageWidth: 595, pageHeight: 842, orientation: 'Portrait', leftMargin: 20, rightMargin: 20, topMargin: 30, bottomMargin: 30, columnCount: 1, columnWidth: 555, columnSpacing: 0 },
      styles: [],
      dataContract: { fields: [], parameters: [], variables: [] },
      bands: { detail: [{ height: 50, splitType: 'Stretch', elements: [el] }], groups: [] },
    });
    const template = useDocumentoStore.getState().template!;
    // Sintaxe válida → nenhum SUBREPORT_REF_INVALID.
    expect(validateContract(template).messages.filter((m) => m.code === 'SUBREPORT_REF_INVALID')).toHaveLength(0);
  });
});
