import type { OrgRole } from '../types/rbac.js';

/** Role precedence: owner > admin > author > viewer. */
export const ROLE_HIERARCHY: readonly OrgRole[] = ['viewer', 'author', 'admin', 'owner'];

const ROLE_RANK: Record<OrgRole, number> = {
  viewer: 0,
  author: 1,
  admin: 2,
  owner: 3,
};

/** True when `role` meets or exceeds `minimum` in the org role hierarchy. */
export function roleAtLeast(role: OrgRole, minimum: OrgRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

/** Highest role from a list of memberships (for multi-org users). */
export function highestRole(roles: OrgRole[]): OrgRole | null {
  if (roles.length === 0) {
    return null;
  }
  return roles.reduce((best, role) => (ROLE_RANK[role] > ROLE_RANK[best] ? role : best));
}
