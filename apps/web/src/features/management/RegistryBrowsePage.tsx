import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { Badge, Button, Card, Input } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';
import { discoveryApi } from '@/lib/api-client';
import type { DiscoveryIndexEntry } from '@/lib/api-types';

import { AsyncState } from './components/AsyncState';
import { InstallPanel } from './components/InstallPanel';
import styles from './management.module.css';

export function RegistryBrowsePage() {
  const { canView } = useAuth();
  const [search, setSearch] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [selected, setSelected] = useState<DiscoveryIndexEntry | null>(null);

  const indexQuery = useQuery({
    queryKey: ['registry-index'],
    queryFn: () => discoveryApi.getIndex(),
  });

  const searchQuery = useQuery({
    queryKey: ['registry-search', search, tagFilter],
    queryFn: () =>
      discoveryApi.search({
        q: search.trim() || undefined,
        tag: tagFilter.trim() || undefined,
      }),
    enabled: Boolean(search.trim() || tagFilter.trim()),
  });

  const entries = useMemo(() => {
    const raw =
      search.trim() || tagFilter.trim()
        ? (searchQuery.data?.entries ?? [])
        : (indexQuery.data?.entries ?? []);
    return raw.filter((entry) => canView({ visibility: entry.visibility }));
  }, [search, tagFilter, searchQuery.data, indexQuery.data, canView]);

  const isLoading =
    search.trim() || tagFilter.trim() ? searchQuery.isLoading : indexQuery.isLoading;
  const error = (
    search.trim() || tagFilter.trim() ? searchQuery.error : indexQuery.error
  ) as Error | null;

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Registry</h1>
          <p className={styles.muted}>
            Discover public and org-scoped MCPs from the catalog index.
          </p>
        </div>
      </div>

      <div className={styles.toolbar}>
        <Input
          placeholder="Search catalog…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setSelected(null);
          }}
          aria-label="Search registry"
        />
        <Input
          placeholder="Filter by tag"
          value={tagFilter}
          onChange={(e) => {
            setTagFilter(e.target.value);
            setSelected(null);
          }}
          aria-label="Filter by tag"
        />
        <Button
          variant="ghost"
          onClick={() => {
            setSearch('');
            setTagFilter('');
            setSelected(null);
          }}
        >
          Clear
        </Button>
      </div>

      <AsyncState
        isLoading={isLoading}
        error={error}
        isEmpty={entries.length === 0}
        emptyMessage="No MCPs found in the registry."
      >
        <div className={styles.registryGrid}>
          {entries.map((entry) => (
            <Card key={`${entry.org}/${entry.slug}`} className={styles.registryCard}>
              <h2 className={styles.registryCardTitle}>{entry.name}</h2>
              <p className={styles.muted}>{entry.description}</p>
              <div className={styles.metaGrid}>
                <div className={styles.metaItem}>
                  <dt>Version</dt>
                  <dd>{entry.latestVersion}</dd>
                </div>
                <div className={styles.metaItem}>
                  <dt>Tools</dt>
                  <dd>{entry.toolCount}</dd>
                </div>
                <div className={styles.metaItem}>
                  <dt>Visibility</dt>
                  <dd>{entry.visibility}</dd>
                </div>
              </div>
              <div className={styles.tagList}>
                {entry.tags.map((tag) => (
                  <Badge key={tag}>{tag}</Badge>
                ))}
              </div>
              <p className={styles.muted}>{entry.toolNames.join(', ')}</p>
              <div className={styles.rowActions}>
                <Button
                  variant={selected?.slug === entry.slug ? 'primary' : 'secondary'}
                  onClick={() => setSelected(entry)}
                >
                  Install
                </Button>
                <Link to={`/registry?org=${entry.org}&slug=${entry.slug}`}>
                  <Button variant="ghost">Details</Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </AsyncState>

      {selected && (
        <div style={{ marginTop: '1.5rem' }}>
          <InstallPanel org={selected.org} slug={selected.slug} version={selected.latestVersion} />
        </div>
      )}
    </div>
  );
}
