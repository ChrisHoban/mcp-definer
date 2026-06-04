import { useMemo, useState } from 'react';

import { AgentPreviewPanel, JsonSchemaForm } from '@/components';
import { Alert, Badge, Button, Card, Input, Label, Textarea } from '@/components/ui';
import {
  assessDescriptionQuality,
  getEffectiveDescription,
  getEffectiveToolName,
  isOperationIncluded,
  updateInputSchemaOverride,
  updateToolDescription,
  updateToolGroup,
  updateToolRename,
} from '@/lib/curation';

import { useWizard } from '../WizardContext';

import styles from './steps.module.css';

export function CurateStep({
  onNext,
  onBack,
  onSaveDraft,
  saving,
}: {
  onNext: () => void;
  onBack: () => void;
  onSaveDraft: () => Promise<void>;
  saving: boolean;
}) {
  const { ir, curation, setCuration, manifestPreview } = useWizard();
  const [saveError, setSaveError] = useState<string | null>(null);

  const includedOps = useMemo(
    () => (ir?.operations ?? []).filter((op) => isOperationIncluded(op.id, curation)),
    [ir, curation],
  );

  const [selectedId, setSelectedId] = useState<string | null>(includedOps[0]?.id ?? null);
  const selected = includedOps.find((o) => o.id === selectedId) ?? includedOps[0];

  const toolPreview = manifestPreview?.tools.find(
    (t) => t.name === (selected ? getEffectiveToolName(selected.id, curation) : ''),
  );

  async function handleContinue() {
    setSaveError(null);
    try {
      await onSaveDraft();
      onNext();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save draft');
    }
  }

  if (!ir) return <p>No spec loaded.</p>;

  return (
    <div className={styles.splitLayout}>
      <div className={styles.mainCol}>
        <Card>
          <h2 className={styles.heading}>Curate tools</h2>
          <p className={styles.desc}>
            Edit LLM-facing names and descriptions. Quality metadata improves agent tool selection (NFR-10).
          </p>

          <div className={styles.curateLayout}>
            <ul className={styles.toolList} role="listbox" aria-label="Included tools">
              {includedOps.map((op) => {
                const name = getEffectiveToolName(op.id, curation);
                const desc = getEffectiveDescription(op.id, curation, op.summary ?? op.description);
                const quality = assessDescriptionQuality(desc);
                return (
                  <li key={op.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected?.id === op.id}
                      className={`${styles.toolItem} ${selected?.id === op.id ? styles.toolItemActive : ''}`}
                      onClick={() => setSelectedId(op.id)}
                    >
                      <code>{name}</code>
                      <Badge variant={quality.level === 'good' ? 'success' : quality.level === 'warn' ? 'warning' : 'danger'}>
                        {quality.level}
                      </Badge>
                    </button>
                  </li>
                );
              })}
            </ul>

            {selected && (
              <div className={styles.toolEditor}>
                <div className={styles.field}>
                  <Label htmlFor="tool-name">Tool name</Label>
                  <Input
                    id="tool-name"
                    value={getEffectiveToolName(selected.id, curation)}
                    onChange={(e) => setCuration(updateToolRename(curation, selected.id, e.target.value))}
                  />
                </div>
                <div className={styles.field}>
                  <Label htmlFor="tool-desc">Description (LLM-facing)</Label>
                  <Textarea
                    id="tool-desc"
                    value={getEffectiveDescription(selected.id, curation, selected.summary ?? selected.description)}
                    onChange={(e) => setCuration(updateToolDescription(curation, selected.id, e.target.value))}
                    rows={4}
                  />
                  {(() => {
                    const q = assessDescriptionQuality(
                      getEffectiveDescription(selected.id, curation, selected.summary ?? selected.description),
                    );
                    return (
                      <Alert variant={q.level === 'good' ? 'success' : q.level === 'warn' ? 'warning' : 'danger'}>
                        {q.message}
                      </Alert>
                    );
                  })()}
                </div>
                <div className={styles.field}>
                  <Label htmlFor="tool-group">Group</Label>
                  <Input
                    id="tool-group"
                    value={curation.toolGroups?.[selected.id] ?? ''}
                    onChange={(e) => setCuration(updateToolGroup(curation, selected.id, e.target.value))}
                    placeholder="e.g. pets, orders"
                  />
                </div>
                {toolPreview?.inputSchema && (
                  <div className={styles.field}>
                    <Label>Input schema (preview edit)</Label>
                    <JsonSchemaForm
                      schema={toolPreview.inputSchema as Record<string, unknown>}
                      value={{}}
                      onChange={() => {}}
                      disabled
                    />
                    <p className={styles.hint}>
                      Schema tightening via overrides is available in advanced mode below.
                    </p>
                    <details>
                      <summary>Advanced: raw inputSchema override</summary>
                      <Textarea
                        value={JSON.stringify(
                          curation.inputSchemaOverrides?.[selected.id] ?? toolPreview.inputSchema,
                          null,
                          2,
                        )}
                        onChange={(e) => {
                          try {
                            const parsed = JSON.parse(e.target.value) as Record<string, unknown>;
                            setCuration(updateInputSchemaOverride(curation, selected.id, parsed));
                          } catch {
                            /* ignore parse errors while typing */
                          }
                        }}
                        rows={8}
                      />
                    </details>
                  </div>
                )}
              </div>
            )}
          </div>

          {saveError && <Alert variant="danger">{saveError}</Alert>}

          <div className={styles.actions}>
            <Button variant="ghost" onClick={onBack}>Back</Button>
            <Button onClick={handleContinue} disabled={saving || includedOps.length === 0}>
              {saving ? 'Saving…' : 'Save draft & continue'}
            </Button>
          </div>
        </Card>
      </div>
      {manifestPreview && (
        <aside className={styles.previewCol}>
          <AgentPreviewPanel tools={manifestPreview.tools} />
        </aside>
      )}
    </div>
  );
}
