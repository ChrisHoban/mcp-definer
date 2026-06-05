import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { Badge, Button, Card, Input, Select } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api-client';
import type { McpSummary } from '@/lib/api-types';

import { AsyncState } from './components/AsyncState';
import { ConfirmDialog } from './components/ConfirmDialog';
import styles from './management.module.css';

type SortKey = 'name' | 'status' | 'visibility';

function statusBadgeVariant(status: McpSummary['status']) {
  if (status === 'published') return 'success';
  if (status === 'draft') return 'default';
  if (status === 'deprecated') return 'warning';
  return 'danger';
}

export function McpListPage() {
  const { can, canView } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('name');
  const [deleteTarget, setDeleteTarget] = useState<McpSummary | null>(null);

  const listQuery = useQuery({
    queryKey: ['mcps', statusFilter, visibilityFilter, tagFilter],
    queryFn: () =>
      api.listMcps({
        status: statusFilter || undefined,
        visibility: visibilityFilter || undefined,
        tag: tagFilter || undefined,
      }),
  });

  const visibleItems = useMemo(
    () => (listQuery.data?.items ?? []).filter((mcp) => canView({ visibility: mcp.visibility })),
    [listQuery.data?.items, canView],
  );

  const detailQueries = useQueries({
    queries: visibleItems.map((mcp) => ({
      queryKey: ['mcp', mcp.id],
      queryFn: () => api.getMcp(mcp.id),
      staleTime: 30_000,
    })),
  });

  const enriched = useMemo(() => {
    const detailMap = new Map(
      detailQueries.map((q, i) => [visibleItems[i]?.id, q.data]),
    );
    return visibleItems.map((mcp) => ({
      ...mcp,
      latestVersion: detailMap.get(mcp.id)?.latestVersion ?? null,
    }));
  }, [visibleItems, detailQueries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = enriched;
    if (q) {
      rows = rows.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.slug.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q) ||
          m.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    return [...rows].sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'status') return a.status.localeCompare(b.status);
      return a.visibility.localeCompare(b.visibility);
    });
  }, [enriched, search, sortBy]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteMcp(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mcps'] });
      setDeleteTarget(null);
    },
  });

  const versionsQuery = useQueries({
    queries: visibleItems.map((mcp) => ({
      queryKey: ['versions', mcp.id],
      queryFn: () => api.listVersions(mcp.id),
      enabled: can('mcp:edit'),
    })),
  });

  function draftVersionFor(mcpId: string): string | null {
    const idx = visibleItems.findIndex((m) => m.id === mcpId);
    const versions = versionsQuery[idx]?.data?.items ?? [];
    const draft = versions.find((v) => !v.publishedAt);
    return draft?.version ?? null;
  }

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>MCP Catalog</h1>
          <p className={styles.muted}>Manage your organization&apos;s MCP definitions.</p>
        </div>
        {can('mcp:create') && (
          <Button variant="primary" onClick={() => navigate('/mcps/new')}>
            Create MCP
          </Button>
        )}
      </div>

      <div className={styles.toolbar}>
        <Input
          className={styles.toolbarSearch}
          placeholder="Search name, slug, tags…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search MCPs"
        />
        <div className={styles.filterBar}>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Status</span>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
            >
              <option value="">All</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="deprecated">Deprecated</option>
              <option value="retired">Retired</option>
            </Select>
          </div>
          <span className={styles.filterDivider} aria-hidden="true">
            |
          </span>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Visibility</span>
            <Select
              value={visibilityFilter}
              onChange={(e) => setVisibilityFilter(e.target.value)}
              aria-label="Filter by visibility"
            >
              <option value="">All</option>
              <option value="private">Private</option>
              <option value="org">Org</option>
              <option value="public">Public</option>
            </Select>
          </div>
          <span className={styles.filterDivider} aria-hidden="true">
            |
          </span>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Sort</span>
            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              aria-label="Sort by"
            >
              <option value="name">Name</option>
              <option value="status">Status</option>
              <option value="visibility">Visibility</option>
            </Select>
          </div>
          <span className={styles.filterDivider} aria-hidden="true">
            |
          </span>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Tag</span>
            <Input
              placeholder="Search"
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              aria-label="Filter by tag"
            />
          </div>
        </div>
      </div>

      <AsyncState
        isLoading={listQuery.isLoading}
        error={listQuery.error as Error | null}
        isEmpty={filtered.length === 0}
        emptyMessage="No MCPs match your filters. Create one to get started."
      >
        <Card className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Latest version</th>
                <th>Channel</th>
                <th>Visibility</th>
                <th>Tags</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((mcp) => (
                <tr key={mcp.id}>
                  <td>
                    <Link to={`/mcps/${mcp.id}`}>{mcp.name}</Link>
                    <div className={styles.muted}>{mcp.org}/{mcp.slug}</div>
                  </td>
                  <td>
                    <Badge variant={statusBadgeVariant(mcp.status)}>{mcp.status}</Badge>
                  </td>
                  <td>{mcp.latestVersion?.version ?? '—'}</td>
                  <td>{mcp.latestVersion?.channel ?? '—'}</td>
                  <td>{mcp.visibility}</td>
                  <td>
                    <div className={styles.tagList}>
                      {mcp.tags.map((tag) => (
                        <Badge key={tag}>{tag}</Badge>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div className={styles.rowActions}>
                      <Button variant="ghost" onClick={() => navigate(`/mcps/${mcp.id}`)}>
                        View
                      </Button>
                      {can('mcp:edit') && (
                        <Button
                          variant="ghost"
                          onClick={() => {
                            const draft = draftVersionFor(mcp.id);
                            if (draft) {
                              navigate(`/mcps/${mcp.id}/versions/${draft}/edit`);
                            } else {
                              navigate(`/mcps/${mcp.id}`);
                            }
                          }}
                        >
                          Edit
                        </Button>
                      )}
                      {can('mcp:test_invoke') && (
                        <Button variant="ghost" onClick={() => navigate(`/mcps/${mcp.id}/test`)}>
                          Test
                        </Button>
                      )}
                      {can('mcp:deprecate') && mcp.status === 'published' && (
                        <Button variant="ghost" onClick={() => navigate(`/mcps/${mcp.id}`)}>
                          Deprecate
                        </Button>
                      )}
                      {can('mcp:delete') && (
                        <Button variant="ghost" onClick={() => setDeleteTarget(mcp)}>
                          Delete
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </AsyncState>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete MCP"
        message={`Delete "${deleteTarget?.name}"? This retires the MCP and removes it from the catalog.`}
        confirmLabel="Delete"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
