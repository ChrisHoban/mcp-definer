import { useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { Alert, Button, Card, Select, Spinner } from '@/components/ui';
import { discoveryApi } from '@/lib/api-client';

import styles from '../management.module.css';

function formatCursorConfig(snippet: {
  command: string;
  args: string[];
  env: Record<string, string>;
}): string {
  const serverName = 'mcp-server';
  return JSON.stringify(
    {
      mcpServers: {
        [serverName]: {
          command: snippet.command,
          args: snippet.args,
          env: snippet.env,
        },
      },
    },
    null,
    2,
  );
}

function formatCliCommand(snippet: { command: string; args: string[] }): string {
  return [snippet.command, ...snippet.args].join(' ');
}

export function InstallPanel({
  org,
  slug,
  version,
}: {
  org: string;
  slug: string;
  version?: string;
}) {
  const [harness, setHarness] = useState('cursor');
  const [copied, setCopied] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['install', org, slug, harness, version],
    queryFn: () => discoveryApi.getInstallSnippet(org, slug, harness, version),
  });

  const copyText = useCallback(async (label: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  if (isLoading) {
    return (
      <Card>
        <Spinner /> Loading install snippet…
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="danger">Failed to load install snippet: {(error as Error).message}</Alert>
    );
  }

  if (!data) return null;

  const configJson = formatCursorConfig(data.snippet);
  const cliCommand = formatCliCommand(data.snippet);

  return (
    <Card className={styles.installPanel}>
      <h3 className={styles.sectionTitle}>Install</h3>
      <p className={styles.muted}>
        Per ADR-008: one global runtime install per machine; each MCP is a manifest reference.
        Secret values are never included — set env vars locally at install time.
      </p>

      <div className={styles.fieldRow}>
        <label htmlFor="harness-select">Harness</label>
        <Select id="harness-select" value={harness} onChange={(e) => setHarness(e.target.value)}>
          <option value="cursor">Cursor</option>
          <option value="claude-desktop">Claude Desktop</option>
          <option value="generic">Generic</option>
        </Select>
      </div>

      <div className={styles.snippetBlock}>
        <div className={styles.snippetHeader}>
          <span>CLI command</span>
          <Button variant="ghost" onClick={() => copyText('cli', cliCommand)}>
            {copied === 'cli' ? 'Copied!' : 'Copy'}
          </Button>
        </div>
        <pre className={styles.codeBlock}>{cliCommand}</pre>
      </div>

      <div className={styles.snippetBlock}>
        <div className={styles.snippetHeader}>
          <span>Cursor MCP config</span>
          <Button variant="ghost" onClick={() => copyText('config', configJson)}>
            {copied === 'config' ? 'Copied!' : 'Copy'}
          </Button>
        </div>
        <pre className={styles.codeBlock}>{configJson}</pre>
      </div>

      <div className={styles.snippetBlock}>
        <div className={styles.snippetHeader}>
          <span>Environment variables (placeholders only)</span>
        </div>
        <pre className={styles.codeBlock}>
          {Object.entries(data.snippet.env)
            .map(([key, value]) => `${key}=${value}`)
            .join('\n')}
        </pre>
      </div>
    </Card>
  );
}
