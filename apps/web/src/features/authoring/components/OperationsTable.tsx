import { useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

import type { CurationProfile, IrOperation } from '@mcp-definer/schemas';

import { Badge, Button, Input, Select } from '@/components/ui';
import { bulkSetExcluded, isOperationIncluded } from '@/lib/curation';

import styles from './OperationsTable.module.css';

export interface OperationsTableProps {
  operations: IrOperation[];
  curation: CurationProfile;
  onCurationChange: (c: CurationProfile) => void;
}

export function OperationsTable({ operations, curation, onCurationChange }: OperationsTableProps) {
  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const parentRef = useRef<HTMLDivElement>(null);

  const methods = useMemo(
    () => [...new Set(operations.map((o) => o.method))].sort(),
    [operations],
  );

  const tags = useMemo(() => {
    const set = new Set<string>();
    for (const op of operations) {
      for (const t of op.tags ?? []) set.add(t);
    }
    return [...set].sort();
  }, [operations]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return operations.filter((op) => {
      if (methodFilter && op.method !== methodFilter) return false;
      if (tagFilter && !(op.tags ?? []).includes(tagFilter)) return false;
      if (!q) return true;
      const hay = [op.id, op.path, op.summary, op.description, ...(op.tags ?? [])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [operations, search, methodFilter, tagFilter]);

  const visibleIds = filtered.map((o) => o.id);
  const allIncluded = visibleIds.every((id) => isOperationIncluded(id, curation));
  const someIncluded = visibleIds.some((id) => isOperationIncluded(id, curation));

  const rowVirtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 10,
  });

  function toggleOne(id: string, included: boolean) {
    onCurationChange(bulkSetExcluded(curation, [id], !included));
  }

  function toggleAll(included: boolean) {
    onCurationChange(bulkSetExcluded(curation, visibleIds, !included));
  }

  const includedCount = operations.filter((o) => isOperationIncluded(o.id, curation)).length;

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <Input
          placeholder="Search operations…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search operations"
        />
        <Select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)} aria-label="Filter by method">
          <option value="">All methods</option>
          {methods.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </Select>
        <Select value={tagFilter} onChange={(e) => setTagFilter(e.target.value)} aria-label="Filter by tag">
          <option value="">All tags</option>
          {tags.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </Select>
        <div className={styles.bulk}>
          <Button variant="secondary" onClick={() => toggleAll(true)} disabled={allIncluded}>
            Include visible
          </Button>
          <Button variant="secondary" onClick={() => toggleAll(false)} disabled={!someIncluded}>
            Exclude visible
          </Button>
        </div>
      </div>

      <div className={styles.stats}>
        <Badge variant="success">{includedCount} included</Badge>
        <Badge>{operations.length - includedCount} excluded</Badge>
        <Badge>{filtered.length} shown</Badge>
      </div>

      <div className={styles.tableHeader} role="row">
        <span role="columnheader">Include</span>
        <span role="columnheader">Method</span>
        <span role="columnheader">Path</span>
        <span role="columnheader">Operation ID</span>
        <span role="columnheader">Tags</span>
      </div>

      <div ref={parentRef} className={styles.scrollBody}>
        <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const op = filtered[virtualRow.index]!;
            const included = isOperationIncluded(op.id, curation);
            return (
              <div
                key={op.id}
                className={styles.row}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                role="row"
              >
                <label className={styles.checkCell}>
                  <input
                    type="checkbox"
                    checked={included}
                    onChange={(e) => toggleOne(op.id, e.target.checked)}
                    aria-label={`Include ${op.id}`}
                  />
                </label>
                <Badge>{op.method}</Badge>
                <code className={styles.path}>{op.path}</code>
                <span className={styles.opId}>{op.id}</span>
                <span className={styles.tags}>
                  {(op.tags ?? []).map((t) => (
                    <Badge key={t}>{t}</Badge>
                  ))}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 && (
        <p className={styles.empty}>No operations match the current filters.</p>
      )}
    </div>
  );
}
