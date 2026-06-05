import { hasPermission, type OrgRole } from '@mcp-definer/auth';

import { Badge, Button, Card, Input, Label, Select } from '@/components/ui';
import { useAuth } from '@/context/AuthContext';

import styles from './management.module.css';

const ROLES: OrgRole[] = ['viewer', 'author', 'admin', 'owner'];

const PERMISSION_READOUT: {
  label: string;
  permission: Parameters<typeof hasPermission>[1];
  minRole: OrgRole;
}[] = [
  { label: 'Read catalog & MCPs', permission: 'catalog:read', minRole: 'viewer' },
  { label: 'Create / edit drafts', permission: 'mcp:edit', minRole: 'author' },
  { label: 'Test invoke', permission: 'mcp:test_invoke', minRole: 'author' },
  { label: 'Publish', permission: 'mcp:publish', minRole: 'admin' },
  { label: 'Deprecate', permission: 'mcp:deprecate', minRole: 'admin' },
  { label: 'Delete MCPs', permission: 'mcp:delete', minRole: 'admin' },
  { label: 'Org settings', permission: 'org:settings', minRole: 'owner' },
];

export function SettingsPage() {
  const { apiKey, role, orgId, userId, setApiKey, setRole, can } = useAuth();

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Settings</h1>
          <p className={styles.muted}>Phase 1 stub — API key and dev role controls.</p>
        </div>
      </div>

      <div className={styles.grid2}>
        <Card>
          <h2 className={styles.sectionTitle}>API key</h2>
          <p className={styles.muted}>
            Sent as <code>X-API-Key</code> on control-plane requests. Never share production keys.
          </p>
          <div className={styles.settingsForm}>
            <div>
              <Label htmlFor="api-key">API key</Label>
              <Input
                id="api-key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                autoComplete="off"
              />
            </div>
            <p className={styles.muted}>
              Set <code>VITE_API_KEY</code> in the repo-root <code>.env</code> (see{' '}
              <code>.env.example</code>) or enter a key here. Must match{' '}
              <code>MCP_DEFINER_API_KEY</code> on the API.
            </p>
          </div>
        </Card>

        <Card>
          <h2 className={styles.sectionTitle}>Dev role (RBAC preview)</h2>
          <p className={styles.muted}>
            Simulates org membership role for UI gating. Production uses OIDC + org_memberships.
          </p>
          <div className={styles.settingsForm}>
            <div>
              <Label htmlFor="dev-role">Role</Label>
              <Select
                id="dev-role"
                value={role}
                onChange={(e) => setRole(e.target.value as OrgRole)}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </Select>
            </div>
            <dl className={styles.metaGrid}>
              <div className={styles.metaItem}>
                <dt>Org ID</dt>
                <dd>{orgId}</dd>
              </div>
              <div className={styles.metaItem}>
                <dt>User ID</dt>
                <dd>{userId}</dd>
              </div>
            </dl>
          </div>
        </Card>
      </div>

      <Card className={`${styles.section} ${styles.sectionSpaced}`}>
        <h2 className={styles.sectionTitle}>Permission readout</h2>
        <ul className={styles.auditList}>
          {PERMISSION_READOUT.map(({ label, permission, minRole }) => {
            const allowed = hasPermission(role, permission);
            return (
              <li key={permission} className={styles.auditItem}>
                <span>{label}</span>
                <span className={styles.muted}> — requires {minRole}+</span>{' '}
                <Badge variant={allowed ? 'success' : 'default'}>
                  {allowed ? 'allowed' : 'denied'}
                </Badge>
              </li>
            );
          })}
        </ul>
        <p className={styles.muted} style={{ marginTop: '0.75rem' }}>
          Viewer: read-only. Author: edit drafts + test invoke. Admin: publish/deprecate/delete.
          Owner: org settings.
        </p>
      </Card>

      {can('org:settings') && (
        <Card className={styles.section}>
          <h2 className={styles.sectionTitle}>Organization</h2>
          <p className={styles.muted}>Members, billing, and signing keys — deferred to Phase 2.</p>
          <Button variant="secondary" disabled>
            Manage members (coming soon)
          </Button>
        </Card>
      )}
    </div>
  );
}
