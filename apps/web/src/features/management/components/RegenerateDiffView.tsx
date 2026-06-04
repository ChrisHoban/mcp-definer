import { Badge } from '@/components/ui';
import type { ManifestDiff } from '@/lib/api-types';

import styles from '../management.module.css';

function ToolList({
  title,
  items,
  variant,
}: {
  title: string;
  items: ManifestDiff['added'];
  variant: 'success' | 'danger' | 'warning';
}) {
  if (items.length === 0) return null;

  return (
    <div className={styles.diffSection}>
      <h4>
        {title}{' '}
        <Badge variant={variant === 'success' ? 'success' : variant === 'danger' ? 'danger' : 'warning'}>
          {items.length}
        </Badge>
      </h4>
      <ul className={styles.diffList}>
        {items.map((item) => (
          <li key={`${item.operationId}-${item.toolName}`}>
            <strong>{item.toolName}</strong>
            <span className={styles.muted}> ({item.operationId})</span>
            {item.fields.length > 0 && (
              <span className={styles.muted}> — {item.fields.join(', ')}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RegenerateDiffView({ diff }: { diff: ManifestDiff }) {
  const total = diff.added.length + diff.removed.length + diff.changed.length;

  if (total === 0) {
    return <p className={styles.muted}>No tool changes detected.</p>;
  }

  return (
    <div className={styles.diffView}>
      <ToolList title="Added tools" items={diff.added} variant="success" />
      <ToolList title="Removed tools" items={diff.removed} variant="danger" />
      <ToolList title="Changed tools" items={diff.changed} variant="warning" />
    </div>
  );
}
