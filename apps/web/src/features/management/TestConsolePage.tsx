import { useMutation, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { JsonSchemaForm } from '@/components';
import { Alert, Badge, Button, Card } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api-client';
import { ApiError } from '@/lib/api-types';

import { AsyncState } from './components/AsyncState';
import styles from './management.module.css';

const INVOKE_ERROR_LABELS: Record<string, string> = {
  EGRESS_BLOCKED: 'Egress blocked — target host is not on the manifest allow-list.',
  TOOL_VALIDATION: 'Tool input validation failed.',
  UPSTREAM_HTTP: 'Upstream API returned an error.',
};

function redactSecrets(text: string): string {
  return text
    .replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]')
    .replace(/("(?:api[_-]?key|secret|token|authorization)"\s*:\s*")([^"]+)(")/gi, '$1[REDACTED]$3');
}

export function TestConsolePage() {
  const { id = '' } = useParams();
  const { can } = useAuth();

  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [args, setArgs] = useState<Record<string, unknown>>({});
  const [invokeResult, setInvokeResult] = useState<{
    status: number;
    durationMs: number;
    body: unknown;
    requestLog: Record<string, unknown>[];
    errorCode?: string;
  } | null>(null);

  const mcpQuery = useQuery({
    queryKey: ['mcp', id],
    queryFn: () => api.getMcp(id),
    enabled: Boolean(id),
  });

  const version = mcpQuery.data?.latestVersion?.version;
  const versionQuery = useQuery({
    queryKey: ['version', id, version],
    queryFn: () => api.getVersion(id, version!),
    enabled: Boolean(id && version),
  });

  const credentialsQuery = useQuery({
    queryKey: ['credentials', id],
    queryFn: () => api.getCredentials(id),
    enabled: Boolean(id) && can('mcp:configure_auth'),
  });

  const enabledTools = useMemo(
    () => (versionQuery.data?.tools ?? []).filter((t) => t.enabled),
    [versionQuery.data?.tools],
  );

  const activeTool = enabledTools.find((t) => t.name === selectedTool) ?? enabledTools[0] ?? null;

  const invokeMutation = useMutation({
    mutationFn: async () => {
      if (!activeTool) throw new Error('Select a tool');
      const start = performance.now();
      try {
        const body = await api.invokeTool(id, activeTool.name, args, version);
        return {
          status: 200,
          durationMs: Math.round(performance.now() - start),
          body: body.result,
          requestLog: body.requestLog,
        };
      } catch (err) {
        const durationMs = Math.round(performance.now() - start);
        if (err instanceof ApiError) {
          return {
            status: err.status,
            durationMs,
            body: err.problem ?? { message: err.message },
            requestLog: [] as Record<string, unknown>[],
            errorCode: err.problem?.code,
          };
        }
        throw err;
      }
    },
    onSuccess: (result) => setInvokeResult(result),
  });

  const hasCredential = credentialsQuery.data?.binding?.hasSecret === true;

  if (!can('mcp:test_invoke')) {
    return (
      <Alert variant="warning">
        Your role does not have permission to invoke tools. Authors and above can use the test console.
      </Alert>
    );
  }

  return (
    <div>
      <div className={styles.breadcrumb}>
        <Link to="/">Catalog</Link>
        {' / '}
        <Link to={`/mcps/${id}`}>{mcpQuery.data?.name ?? 'MCP'}</Link>
        {' / Test'}
      </div>

      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Test console</h1>
          <p className={styles.muted}>
            Invoke tools against the live target API via the shared request pipeline (ADR-012).
          </p>
        </div>
      </div>

      <AsyncState
        isLoading={mcpQuery.isLoading || versionQuery.isLoading}
        error={(mcpQuery.error ?? versionQuery.error) as Error | null}
        isEmpty={enabledTools.length === 0}
        emptyMessage="No enabled tools on the latest version."
      >
        {!hasCredential && can('mcp:configure_auth') && (
          <Alert variant="warning">
            Configure a credential binding with a secret before invoking.{' '}
            <Link to={`/mcps/${id}/versions/${version}/edit`}>Open version editor</Link> or{' '}
            <Link to="/settings">Settings</Link>.
          </Alert>
        )}

        {credentialsQuery.isSuccess && !hasCredential && (
          <Alert variant="warning">
            No credential secret is bound for this MCP. Set one in the auth step of the version editor before testing.
          </Alert>
        )}

        <div className={styles.testLayout}>
          <Card>
            <h2 className={styles.sectionTitle}>Tools</h2>
            <div className={styles.toolPicker} role="listbox" aria-label="Select tool">
              {enabledTools.map((tool) => (
                <button
                  key={tool.name}
                  type="button"
                  role="option"
                  aria-selected={activeTool?.name === tool.name}
                  className={
                    activeTool?.name === tool.name
                      ? `${styles.toolPickerBtn} ${styles.toolPickerBtnActive}`
                      : styles.toolPickerBtn
                  }
                  onClick={() => {
                    setSelectedTool(tool.name);
                    setArgs({});
                    setInvokeResult(null);
                  }}
                >
                  <code>{tool.name}</code>
                </button>
              ))}
            </div>
          </Card>

          <Card>
            {activeTool && (
              <>
                <h2 className={styles.sectionTitle}>{activeTool.name}</h2>
                <p className={styles.muted}>{activeTool.description}</p>

                <JsonSchemaForm
                  schema={activeTool.inputSchema as Record<string, unknown>}
                  value={args}
                  onChange={setArgs}
                />

                <div className={styles.rowActions} style={{ marginTop: '1rem' }}>
                  <Button
                    variant="primary"
                    onClick={() => invokeMutation.mutate()}
                    disabled={!hasCredential || invokeMutation.isPending}
                  >
                    {invokeMutation.isPending ? 'Invoking…' : 'Invoke'}
                  </Button>
                  {version && <Badge>v{version}</Badge>}
                </div>

                {invokeResult && (
                  <div className={styles.resultBlock}>
                    <h3 className={styles.sectionTitle}>Result</h3>
                    <div className={styles.metaGrid}>
                      <div className={styles.metaItem}>
                        <dt>Status</dt>
                        <dd>
                          <Badge variant={invokeResult.status < 400 ? 'success' : 'danger'}>
                            {invokeResult.status}
                          </Badge>
                        </dd>
                      </div>
                      <div className={styles.metaItem}>
                        <dt>Duration</dt>
                        <dd>{invokeResult.durationMs} ms</dd>
                      </div>
                      {invokeResult.errorCode && (
                        <div className={styles.metaItem}>
                          <dt>Code</dt>
                          <dd>{invokeResult.errorCode}</dd>
                        </div>
                      )}
                    </div>

                    {invokeResult.errorCode && (
                      <Alert variant="danger">
                        {INVOKE_ERROR_LABELS[invokeResult.errorCode] ?? invokeResult.errorCode}
                      </Alert>
                    )}

                    <div className={styles.snippetBlock}>
                      <div className={styles.snippetHeader}>
                        <span>Response</span>
                      </div>
                      <pre className={styles.codeBlock}>
                        {JSON.stringify(invokeResult.body, null, 2)}
                      </pre>
                    </div>

                    {invokeResult.requestLog.length > 0 && (
                      <div className={styles.snippetBlock}>
                        <div className={styles.snippetHeader}>
                          <span>Request log (redacted)</span>
                        </div>
                        <pre className={styles.codeBlock}>
                          {redactSecrets(JSON.stringify(invokeResult.requestLog, null, 2))}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </Card>
        </div>
      </AsyncState>
    </div>
  );
}
