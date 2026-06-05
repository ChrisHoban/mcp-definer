import type { OrgRole, Permission } from '../types/rbac.js';
import { roleAtLeast } from './roles.js';

const PERMISSION_MIN_ROLE: Record<Permission, OrgRole> = {
  'catalog:read': 'viewer',
  'mcp:read': 'viewer',
  'mcp:create': 'author',
  'mcp:edit': 'author',
  'mcp:configure_auth': 'author',
  'mcp:test_invoke': 'author',
  'mcp:publish': 'admin',
  'mcp:deprecate': 'admin',
  'mcp:delete': 'admin',
  'members:manage': 'admin',
  'tags:manage': 'admin',
  'org:settings': 'owner',
  'org:billing': 'owner',
  'signing:manage': 'owner',
};

/** Whether an org role may perform the given control-plane action. */
export function hasPermission(role: OrgRole, permission: Permission): boolean {
  return roleAtLeast(role, PERMISSION_MIN_ROLE[permission]);
}
