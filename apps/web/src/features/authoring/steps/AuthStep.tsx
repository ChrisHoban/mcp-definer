import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { Alert, Button, Card, Input, Label, Select, Spinner } from '@/components/ui';
import { ApiError, api } from '@/lib/api-client';

import { useWizard } from '../WizardContext';

import styles from './steps.module.css';

const AUTH_TYPES = [
  { value: 'apiKey', label: 'API Key' },
  { value: 'bearer', label: 'Bearer token' },
  { value: 'basic', label: 'Basic auth' },
  { value: 'oauth2_cc', label: 'OAuth2 client credentials' },
  { value: 'oauth2_ac', label: 'OAuth2 authorization code (Phase 4)' },
  { value: 'custom', label: 'Custom headers' },
] as const;

export function AuthStep({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const { mcpId, auth, setAuth, clearSecretDraft } = useWizard();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const bindingQuery = useQuery({
    queryKey: ['credentials', mcpId],
    queryFn: () => api.getCredentials(mcpId!),
    enabled: Boolean(mcpId),
  });

  const existing = bindingQuery.data?.binding;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!mcpId) throw new Error('MCP not created yet');
      if (!auth.secretDraft.trim() && !existing?.hasSecret) {
        throw new Error('Enter a secret value to configure authentication');
      }
      if (auth.secretDraft.trim()) {
        const bindingId = auth.bindingId ?? `cb_${mcpId.slice(-8)}`;
        const res = await api.createCredentials(mcpId, {
          id: bindingId,
          authType: auth.authType,
          config: auth.config,
          secret: auth.secretDraft,
        });
        clearSecretDraft();
        return res.binding;
      }
      return existing;
    },
    onSuccess: (binding) => {
      if (binding) {
        setAuth((a) => ({
          ...a,
          bindingId: binding.id,
          hasSecret: binding.hasSecret,
          secretRef: binding.secretRef,
          secretDraft: '',
        }));
      }
      queryClient.invalidateQueries({ queryKey: ['credentials', mcpId] });
      setError(null);
      onNext();
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Failed to save credentials');
    },
  });

  if (!mcpId) {
    return (
      <Card>
        <Alert variant="warning">Save the draft MCP first (complete the curation step).</Alert>
        <Button variant="ghost" onClick={onBack}>Back</Button>
      </Card>
    );
  }

  return (
    <div className={styles.step}>
      <Card>
        <h2 className={styles.heading}>Configure authentication</h2>
        <p className={styles.desc}>
          One credential binding per MCP (ADR-009). Secret values are write-only and never displayed after save.
        </p>

        <div className={styles.field}>
          <Label htmlFor="auth-type">Auth type</Label>
          <Select
            id="auth-type"
            value={auth.authType}
            onChange={(e) => {
              const authType = e.target.value as typeof auth.authType;
              const config =
                authType === 'apiKey'
                  ? { in: 'header', name: 'api_key' }
                  : authType === 'bearer'
                    ? {}
                    : authType === 'oauth2_cc'
                      ? { tokenUrl: '' }
                      : authType === 'oauth2_ac'
                        ? { authorizationUrl: '', tokenUrl: '' }
                        : authType === 'custom'
                          ? { headers: {} }
                          : {};
              setAuth((a) => ({ ...a, authType, config }));
            }}
          >
            {AUTH_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </Select>
        </div>

        {auth.authType === 'apiKey' && (
          <div className={styles.metaGrid}>
            <div>
              <Label htmlFor="key-in">Location</Label>
              <Select
                id="key-in"
                value={String(auth.config.in ?? 'header')}
                onChange={(e) => setAuth((a) => ({ ...a, config: { ...a.config, in: e.target.value } }))}
              >
                <option value="header">Header</option>
                <option value="query">Query</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="key-name">Parameter name</Label>
              <Input
                id="key-name"
                value={String(auth.config.name ?? '')}
                onChange={(e) => setAuth((a) => ({ ...a, config: { ...a.config, name: e.target.value } }))}
              />
            </div>
          </div>
        )}

        {auth.authType === 'oauth2_ac' && (
          <Alert variant="info">
            OAuth2 authorization code flow will be available in Phase 4. Configure metadata now; consent flow is stubbed.
          </Alert>
        )}

        {(existing?.hasSecret || auth.hasSecret) && (
          <Alert variant="success">
            Secret configured — ref: <code>{existing?.secretRef ?? auth.secretRef}</code>
            {' '}(value masked, write-only)
          </Alert>
        )}

        <div className={styles.field}>
          <Label htmlFor="secret">
            {existing?.hasSecret ? 'Replace secret (optional)' : 'Secret value'}
          </Label>
          <Input
            id="secret"
            type="password"
            autoComplete="new-password"
            value={auth.secretDraft}
            onChange={(e) => setAuth((a) => ({ ...a, secretDraft: e.target.value }))}
            placeholder={existing?.hasSecret ? '••••••••' : 'Enter API key or token'}
          />
          <p className={styles.hint}>Never logged or shown after save (ADR-004).</p>
        </div>

        {error && <Alert variant="danger">{error}</Alert>}

        <div className={styles.actions}>
          <Button variant="ghost" onClick={onBack}>Back</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Spinner /> : null}
            Save & continue
          </Button>
        </div>
      </Card>
    </div>
  );
}
