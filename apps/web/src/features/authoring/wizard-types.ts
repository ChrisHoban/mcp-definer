export const WIZARD_STEPS = [
  { id: 'import', label: 'Import spec' },
  { id: 'preview', label: 'Preview operations' },
  { id: 'curate', label: 'Curate tools' },
  { id: 'auth', label: 'Configure auth' },
  { id: 'validate', label: 'Validate' },
  { id: 'test', label: 'Test' },
  { id: 'publish', label: 'Publish' },
] as const;

export type WizardStepId = (typeof WIZARD_STEPS)[number]['id'];

export interface McpMeta {
  slug: string;
  name: string;
  description: string;
  visibility: 'private' | 'org' | 'public';
}

export interface AuthConfigState {
  authType: 'apiKey' | 'bearer' | 'basic' | 'oauth2_cc' | 'oauth2_ac' | 'custom';
  config: Record<string, unknown>;
  /** Write-only — never persisted in React state after save */
  secretDraft: string;
  bindingId: string | null;
  hasSecret: boolean;
  secretRef: string | null;
}

export interface ValidationState {
  valid: boolean | null;
  errors: { path?: string; message: string; code?: string }[];
  warnings: { path?: string; message: string; code?: string }[];
  lastCheckedAt: string | null;
}

export interface PublishState {
  semver: string;
  channel: 'stable' | 'beta';
  changelog: string;
  published: boolean;
  publishedAt: string | null;
}
