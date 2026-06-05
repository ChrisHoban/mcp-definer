import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';

import { Alert, Button, Card, Input, Label, Select, Spinner, Textarea } from '@/components/ui';
import { ApiError, api } from '@/lib/api-client';
import { useAuth } from '@/context/AuthContext';

import { useWizard } from '../WizardContext';

import styles from './steps.module.css';

export function PublishStep({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate();
  const { can } = useAuth();
  const { mcpId, version, publish, setPublish, validation, isPublished } = useWizard();
  const [error, setError] = useState<string | null>(null);

  const canPublish =
    can('mcp:publish') && validation.valid === true && !isPublished && !publish.published;

  const publishMutation = useMutation({
    mutationFn: () =>
      api.publishVersion(mcpId!, version, {
        channel: publish.channel,
        changelog: publish.changelog,
      }),
    onSuccess: (data) => {
      setPublish((p) => ({
        ...p,
        published: true,
        publishedAt: data.publishedAt,
      }));
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'Publish failed');
    },
  });

  if (isPublished) {
    return (
      <Card>
        <Alert variant="warning">
          This version is already published and immutable (ADR-006). Create a new version to make
          changes.
        </Alert>
        <div className={styles.actions}>
          <Button onClick={() => navigate(`/mcps/${mcpId}`)}>View MCP</Button>
        </div>
      </Card>
    );
  }

  if (publish.published) {
    return (
      <Card>
        <Alert variant="success">
          Published v{version} to {publish.channel} channel at {publish.publishedAt}. This version
          is now immutable.
        </Alert>
        <div className={styles.actions}>
          <Link to={`/mcps/${mcpId}`}>View MCP detail →</Link>
        </div>
      </Card>
    );
  }

  return (
    <div className={styles.step}>
      <Card>
        <h2 className={styles.heading}>Publish</h2>
        <p className={styles.desc}>
          Choose semver and channel. Published versions are immutable — changes require a new
          version (ADR-006).
        </p>

        {!can('mcp:publish') && (
          <Alert variant="warning">
            Your role does not have publish permission (<code>mcp:publish</code> requires admin).
          </Alert>
        )}

        {validation.valid !== true && (
          <Alert variant="danger">Run validation and fix all errors before publishing.</Alert>
        )}

        <div className={styles.metaGrid}>
          <div>
            <Label htmlFor="semver">Version</Label>
            <Input
              id="semver"
              value={publish.semver}
              onChange={(e) => setPublish((p) => ({ ...p, semver: e.target.value }))}
              disabled
            />
            <p className={styles.hint}>Version was set at draft creation ({version}).</p>
          </div>
          <div>
            <Label htmlFor="channel">Channel</Label>
            <Select
              id="channel"
              value={publish.channel}
              onChange={(e) =>
                setPublish((p) => ({ ...p, channel: e.target.value as 'stable' | 'beta' }))
              }
            >
              <option value="stable">stable</option>
              <option value="beta">beta</option>
            </Select>
          </div>
        </div>

        <div className={styles.field}>
          <Label htmlFor="changelog">Changelog</Label>
          <Textarea
            id="changelog"
            value={publish.changelog}
            onChange={(e) => setPublish((p) => ({ ...p, changelog: e.target.value }))}
            placeholder="Initial release…"
            rows={4}
          />
        </div>

        <Alert variant="info">
          After publish, this version cannot be edited. To update tools or schemas, create a new
          draft version.
        </Alert>

        {error && <Alert variant="danger">{error}</Alert>}

        <div className={styles.actions}>
          <Button variant="ghost" onClick={onBack}>
            Back
          </Button>
          <Button
            onClick={() => publishMutation.mutate()}
            disabled={!canPublish || publishMutation.isPending}
          >
            {publishMutation.isPending ? <Spinner /> : null}
            Publish v{version}
          </Button>
        </div>
      </Card>
    </div>
  );
}
