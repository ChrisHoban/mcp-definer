import type { ManifestTool } from '@mcp-definer/schemas';

import { Badge, Card } from '@/components/ui';

import styles from './AgentPreviewPanel.module.css';

export interface AgentPreviewPanelProps {
  tools: ManifestTool[];
  title?: string;
}

/** Renders tools as an agent/harness would see them (NFR-10). */
export function AgentPreviewPanel({
  tools,
  title = 'How the agent sees this',
}: AgentPreviewPanelProps) {
  const enabled = tools.filter((t) => t.enabled);

  return (
    <Card className={styles.panel}>
      <div className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
        <Badge>{enabled.length} tools</Badge>
      </div>
      <p className={styles.subtitle}>
        This is the tool list an LLM receives — optimize names and descriptions for accurate
        selection.
      </p>
      <div className={styles.toolList} role="list">
        {enabled.length === 0 ? (
          <p className={styles.empty}>No tools included yet.</p>
        ) : (
          enabled.map((tool) => (
            <article key={tool.name} className={styles.tool} role="listitem">
              <div className={styles.toolHeader}>
                <code className={styles.toolName}>{tool.name}</code>
                {tool.group && <Badge variant="default">{tool.group}</Badge>}
              </div>
              <p className={styles.toolDesc}>
                {tool.description || <em className={styles.missing}>No description</em>}
              </p>
              {tool.inputSchema && Object.keys(tool.inputSchema).length > 0 && (
                <details className={styles.schemaDetails}>
                  <summary>inputSchema</summary>
                  <pre className={styles.schema}>{JSON.stringify(tool.inputSchema, null, 2)}</pre>
                </details>
              )}
            </article>
          ))
        )}
      </div>
    </Card>
  );
}
