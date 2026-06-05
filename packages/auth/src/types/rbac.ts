/** Org-scoped role from org_memberships (not users.role). */
export type OrgRole = 'owner' | 'admin' | 'author' | 'viewer';

/** MCP visibility scope. */
export type Visibility = 'private' | 'org' | 'public';

/** Control-plane actions enforced via org_memberships RBAC. */
export type Permission =
  | 'catalog:read'
  | 'mcp:read'
  | 'mcp:create'
  | 'mcp:edit'
  | 'mcp:configure_auth'
  | 'mcp:test_invoke'
  | 'mcp:publish'
  | 'mcp:deprecate'
  | 'mcp:delete'
  | 'members:manage'
  | 'tags:manage'
  | 'org:settings'
  | 'org:billing'
  | 'signing:manage';

export interface OrgMembership {
  orgId: string;
  userId: string;
  role: OrgRole;
}
