/**
 * @archbase/reportlenz-designer-react — API pública (ADR-025).
 *
 * Requer, na aplicação: React 19 e Mantine 9 (`MantineProvider` + o CSS do
 * `@mantine/core`). O render-service é acessado em `apiBaseUrl` com o token
 * de `getAccessToken`.
 */
export { ReportLenzDesigner } from './ReportLenzDesigner';
export type { PropsDeConexao, PropsDoModoControlado, PropsDoModoRegistro, ReportLenzDesignerProps } from './ReportLenzDesigner';
export { ReportLenzPreview } from './ReportLenzPreview';
export type { ReportLenzPreviewProps } from './ReportLenzPreview';
export type { EventoPublicado, EventoSalvo, Recursos } from './designer/integracao';
export type { ObterToken } from './api/cliente';
export type { ZoomDoPreview } from './preview/previewStore';
