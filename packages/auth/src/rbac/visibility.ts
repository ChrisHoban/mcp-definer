import type { OrgMembership, Visibility } from '../types/rbac.js';

export interface McpAccessContext {
  visibility: Visibility;
  orgId: string;
  ownerId: string;
}

/**
 * Whether a caller may read an MCP given its visibility and org membership.
 * Discovery and catalog reads honor this scoping (AUTH-04).
 */
export function canViewMcp(
  membership: OrgMembership | null | undefined,
  mcp: McpAccessContext,
  callerUserId?: string,
): boolean {
  if (mcp.visibility === 'public') {
    return true;
  }

  if (!membership || membership.orgId !== mcp.orgId) {
    return false;
  }

  if (mcp.visibility === 'org') {
    return true;
  }

  // private: org members with viewer+ OR explicit owner
  if (callerUserId && callerUserId === mcp.ownerId) {
    return true;
  }

  return membership.orgId === mcp.orgId;
}
