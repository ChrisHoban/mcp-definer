/**
 * Shared UI components for A7 (authoring) and A8 (management).
 *
 * - JsonSchemaForm — JSON-Schema-driven form renderer (tool inputs, test console)
 * - UI primitives — Button, Input, Card, Alert, etc.
 * - AppLayout — app shell with nav (A8 may extend routes)
 */
export { JsonSchemaForm, type JsonSchemaFormProps, type JsonSchema } from './JsonSchemaForm';
export { AppLayout } from './layout/AppLayout';
export { ErrorBoundary } from './layout/ErrorBoundary';
export { AgentPreviewPanel } from './AgentPreviewPanel';
export * from './ui';
