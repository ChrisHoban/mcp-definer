import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { AgentPreviewPanel } from '@/components';
import { Badge, Button, Card, Textarea } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api-client';
import { ApiError } from '@/lib/api-types';

import { AsyncState } from './components/AsyncState';
import { ConfirmDialog } from './components/ConfirmDialog';
import { InstallPanel } from './components/InstallPanel';
import { RegenerateDiffView } from './components/RegenerateDiffView';
import styles from './management.module.css';

export function McpDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can } = useAuth();

  const [deprecateVersion, setDeprecateVersion] = useState<string | null>(null);
  const [regenerateSpec, setRegenerateSpec] = useState('');
  const [regenerateResult, setRegenerateResult] = useState<Awaited<
    ReturnType<typeof api.regenerateVersion>
  > | null>(null);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  const mcpQuery = useQuery({
    queryKey: ['mcp', id],
    queryFn: () => api.getMcp(id),
    enabled: Boolean(id),
  });

  const versionsQuery = useQuery({
    queryKey: ['versions', id],
    queryFn: () => api.listVersions(id),
    enabled: Boolean(id),
  });

  const latestVer = mcpQuery.data?.latestVersion?.version;
  const versionDetailQuery = useQuery({
    queryKey: ['version', id, latestVer],
    queryFn: () => api.getVersion(id, latestVer!),
    enabled: Boolean(id && latestVer),
  });

  const auditQuery = useQuery({
    queryKey: ['audit'],
    queryFn: () => api.listAudit(),
  });

  const mcpAudit = (auditQuery.data?.items ?? []).filter(
    (e) => e.targetId === id || e.metadata?.mcpId === id,
  );

  const deprecateMutation = useMutation({
    mutationFn: (ver: string) => api.deprecateVersion(id, ver),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mcp', id] });
      queryClient.invalidateQueries({ queryKey: ['versions', id] });
      queryClient.invalidateQueries({ queryKey: ['mcps'] });
      setDeprecateVersion(null);
    },
  });

  const createDraftMutation = useMutation({
    mutationFn: (body: { version: string; manifest: NonNullable<typeof regenerateResult>['manifest'] }) =>
      api.createVersion(id, body),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['versions', id] });
      navigate(`/mcps/${id}/versions/${data.version}/edit`);
    },
  });

  async function handleRegenerate() {
    if (!latestVer || !regenerateSpec.trim()) return;
    setRegenerating(true);
    setRegenerateError(null);
    setRegenerateResult(null);
    try {
      const parsed = await api.parseSpec({ content: regenerateSpec, filename: 'spec.yaml' });
      const result = await api.regenerateVersion(id, latestVer, { newIr: parsed.ir });
      setRegenerateResult(result);
    } catch (err) {
      setRegenerateError(err instanceof ApiError ? err.message : 'Regeneration failed');
    } finally {
      setRegenerating(false);
    }
  }

  function suggestNextDraftVersion(): string {
    const versions = versionsQuery.data?.items ?? [];
    const latest = versions.find((v) => v.publishedAt)?.version ?? '1.0.0';
    const parts = latest.split('.').map(Number);
    if (parts.length === 3 && parts.every((n) => !Number.isNaN(n))) {
      return `${parts[0]}.${parts[1]}.${parts[2] + 1}-draft`;
    }
    return `${latest}-draft`;
  }

  const draftVersion = versionsQuery.data?.items.find((v) => !v.publishedAt);

  return (
    <div>
      <div className={styles.breadcrumb}>
        <Link to="/">Catalog</Link>
        {' / '}
        <span>{mcpQuery.data?.name ?? 'MCP'}</span>
      </div>

      <AsyncState
        isLoading={mcpQuery.isLoading}
        error={mcpQuery.error as Error | null}
      >
        {mcpQuery.data && (
          <>
            <div className={styles.pageHeader}>
              <div>
                <h1 className={styles.pageTitle}>{mcpQuery.data.name}</h1>
                <p className={styles.muted}>{mcpQuery.data.description}</p>
              </div>
              <div className={styles.rowActions}>
                {can('mcp:test_invoke') && (
                  <Button variant="secondary" onClick={() => navigate(`/mcps/${id}/test`)}>
                    Test console
                  </Button>
                )}
                {can('mcp:edit') && draftVersion && (
                  <Button
                    variant="secondary"
                    onClick={() => navigate(`/mcps/${id}/versions/${draftVersion.version}/edit`)}
                  >
                    Edit draft
                  </Button>
                )}
                {can('mcp:edit') && !draftVersion && (
                  <Button variant="secondary" disabled title="Create a new draft version from regeneration">
                    New draft version
                  </Button>
                )}
              </div>
            </div>

            <Card className={styles.section}>
              <dl className={styles.metaGrid}>
                <div className={styles.metaItem}>
                  <dt>Status</dt>
                  <dd>
                    <Badge variant={mcpQuery.data.status === 'published' ? 'success' : 'default'}>
                      {mcpQuery.data.status}
                    </Badge>
                  </dd>
                </div>
                <div className={styles.metaItem}>
                  <dt>Visibility</dt>
                  <dd>{mcpQuery.data.visibility}</dd>
                </div>
                <div className={styles.metaItem}>
                  <dt>Org / slug</dt>
                  <dd>{mcpQuery.data.org}/{mcpQuery.data.slug}</dd>
                </div>
                <div className={styles.metaItem}>
                  <dt>Latest version</dt>
                  <dd>{mcpQuery.data.latestVersion?.version ?? '—'}</dd>
                </div>
              </dl>
              <div className={styles.tagList}>
                {mcpQuery.data.tags.map((tag) => (
                  <Badge key={tag}>{tag}</Badge>
                ))}
              </div>
            </Card>

            <div className={styles.grid2}>
              <Card className={styles.section}>
                <h2 className={styles.sectionTitle}>Version history</h2>
                <AsyncState
                  isLoading={versionsQuery.isLoading}
                  error={versionsQuery.error as Error | null}
                  isEmpty={(versionsQuery.data?.items.length ?? 0) === 0}
                  emptyMessage="No versions yet."
                >
                  <ol className={styles.timeline}>
                    {(versionsQuery.data?.items ?? []).map((v) => (
                      <li key={v.id} className={styles.timelineItem}>
                        <div className={styles.timelineVersion}>
                          v{v.version}{' '}
                          {v.publishedAt && <Badge variant="success">immutable</Badge>}
                          {v.deprecatedAt && <Badge variant="warning">deprecated</Badge>}
                        </div>
                        <div className={styles.muted}>
                          {v.channel ?? 'draft'}
                          {v.publishedAt && ` · published ${new Date(v.publishedAt).toLocaleDateString()}`}
                        </div>
                        <div className={styles.rowActions} style={{ marginTop: '0.5rem' }}>
                          {!v.publishedAt && can('mcp:edit') && (
                            <Button
                              variant="ghost"
                              onClick={() => navigate(`/mcps/${id}/versions/${v.version}/edit`)}
                            >
                              Edit
                            </Button>
                          )}
                          {v.publishedAt && can('mcp:deprecate') && !v.deprecatedAt && (
                            <Button variant="ghost" onClick={() => setDeprecateVersion(v.version)}>
                              Deprecate
                            </Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </AsyncState>
              </Card>

              <Card className={styles.section}>
                <h2 className={styles.sectionTitle}>Audit feed</h2>
                <AsyncState
                  isLoading={auditQuery.isLoading}
                  error={auditQuery.error as Error | null}
                  isEmpty={mcpAudit.length === 0}
                  emptyMessage="No audit events for this MCP."
                >
                  <ul className={styles.auditList}>
                    {mcpAudit.slice(0, 20).map((event) => (
                      <li key={event.id} className={styles.auditItem}>
                        <span className={styles.auditAction}>{event.action}</span>
                        <span className={styles.muted}>
                          {' '}
                          · {new Date(event.createdAt).toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                </AsyncState>
              </Card>
            </div>

            <Card className={styles.section}>
              <h2 className={styles.sectionTitle}>Tools & capabilities</h2>
              <AsyncState
                isLoading={versionDetailQuery.isLoading}
                error={versionDetailQuery.error as Error | null}
                isEmpty={(versionDetailQuery.data?.tools.length ?? 0) === 0}
                emptyMessage="No tools on the latest version."
              >
                <div className={styles.toolGrid}>
                  {(versionDetailQuery.data?.tools ?? [])
                    .filter((t) => t.enabled)
                    .map((tool) => (
                      <div key={tool.name} className={styles.toolCard}>
                        <div className={styles.toolName}>{tool.name}</div>
                        <p className={styles.muted}>{tool.description}</p>
                        {tool.group && <Badge>{tool.group}</Badge>}
                      </div>
                    ))}
                </div>
                {versionDetailQuery.data?.tools && (
                  <div style={{ marginTop: '1rem' }}>
                    <AgentPreviewPanel tools={versionDetailQuery.data.tools.filter((t) => t.enabled)} />
                  </div>
                )}
              </AsyncState>
            </Card>

            {mcpQuery.data.status === 'published' && (
              <InstallPanel
                org={mcpQuery.data.org}
                slug={mcpQuery.data.slug}
                version={mcpQuery.data.latestVersion?.version ?? undefined}
              />
            )}

            {can('mcp:edit') && latestVer && (
              <Card className={styles.section}>
                <h2 className={styles.sectionTitle}>Update from spec (regenerate)</h2>
                <p className={styles.muted}>
                  Paste an updated OpenAPI spec to preview tool drift against v{latestVer}.
                  Accepting creates a new draft version.
                </p>
                <Textarea
                  placeholder="Paste OpenAPI YAML or JSON…"
                  value={regenerateSpec}
                  onChange={(e) => setRegenerateSpec(e.target.value)}
                  rows={6}
                />
                <div className={styles.rowActions} style={{ marginTop: '0.75rem' }}>
                  <Button
                    variant="primary"
                    onClick={handleRegenerate}
                    disabled={!regenerateSpec.trim() || regenerating}
                  >
                    {regenerating ? 'Analyzing…' : 'Preview diff'}
                  </Button>
                  {regenerateResult && (
                    <Button
                      variant="secondary"
                      onClick={() =>
                        createDraftMutation.mutate({
                          version: suggestNextDraftVersion(),
                          manifest: regenerateResult.manifest,
                        })
                      }
                      disabled={createDraftMutation.isPending}
                    >
                      Accept & create draft
                    </Button>
                  )}
                </div>
                {regenerateError && (
                  <p style={{ color: 'var(--danger)', marginTop: '0.75rem' }}>{regenerateError}</p>
                )}
                {regenerateResult && (
                  <div style={{ marginTop: '1rem' }}>
                    <RegenerateDiffView diff={regenerateResult.diff} />
                  </div>
                )}
              </Card>
            )}
          </>
        )}
      </AsyncState>

      <ConfirmDialog
        open={deprecateVersion !== null}
        title="Deprecate version"
        message={`Mark v${deprecateVersion} as deprecated? Consumers should migrate to a newer version.`}
        confirmLabel="Deprecate"
        loading={deprecateMutation.isPending}
        onConfirm={() => deprecateVersion && deprecateMutation.mutate(deprecateVersion)}
        onCancel={() => setDeprecateVersion(null)}
      />
    </div>
  );
}
