import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { canViewMcp, hasPermission, type OrgRole } from '@mcp-definer/auth';

import { getStoredApiKey, setStoredApiKey } from '@/lib/api-client';

const ROLE_KEY = 'mcp-definer-role';

export interface AuthState {
  apiKey: string;
  role: OrgRole;
  orgId: string;
  userId: string;
}

interface AuthContextValue extends AuthState {
  setApiKey: (key: string) => void;
  setRole: (role: OrgRole) => void;
  can: (permission: Parameters<typeof hasPermission>[1]) => boolean;
  canView: (mcp: {
    visibility: 'private' | 'org' | 'public';
    orgId?: string;
    ownerId?: string;
  }) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadRole(): OrgRole {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(ROLE_KEY) as OrgRole | null;
    if (stored) return stored;
  }
  return (import.meta.env.VITE_DEFAULT_ROLE as OrgRole) ?? 'owner';
}

const DEFAULT_ORG_ID = import.meta.env.VITE_DEFAULT_ORG_ID ?? 'org_acme';
const DEFAULT_USER_ID = import.meta.env.VITE_DEFAULT_USER_ID ?? 'user_dev';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKeyState] = useState(getStoredApiKey);
  const [role, setRoleState] = useState<OrgRole>(loadRole);
  const orgId = DEFAULT_ORG_ID;
  const userId = DEFAULT_USER_ID;

  const setApiKey = useCallback((key: string) => {
    setStoredApiKey(key);
    setApiKeyState(key);
  }, []);

  const setRole = useCallback((next: OrgRole) => {
    localStorage.setItem(ROLE_KEY, next);
    setRoleState(next);
  }, []);

  const can = useCallback(
    (permission: Parameters<typeof hasPermission>[1]) => hasPermission(role, permission),
    [role],
  );

  const canView = useCallback(
    (mcp: { visibility: 'private' | 'org' | 'public'; orgId?: string; ownerId?: string }) =>
      canViewMcp(
        { orgId, userId, role },
        {
          visibility: mcp.visibility,
          orgId: mcp.orgId ?? orgId,
          ownerId: mcp.ownerId ?? userId,
        },
        userId,
      ),
    [orgId, userId, role],
  );

  const value = useMemo(
    () => ({ apiKey, role, orgId, userId, setApiKey, setRole, can, canView }),
    [apiKey, role, orgId, userId, setApiKey, setRole, can, canView],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
