export const ROLE_PERMISSIONS: Record<string, string[]> = {
  SUPER_ADMIN: ["*"],
  LOGISTICS_MANAGER: [
    "students:read",
    "payments:read",
    "dispatch:read",
    "dispatch:write",
    "dispatch:approve",
    "transfers:read",
    "transfers:write",
    "transfers:approve",
    "inventory:read",
    "inventory:write",
    "couriers:read",
    "couriers:write",
    "reports:read",
    "reports:export",
    "notifications:read",
    "notifications:templates:write",
    "b2b:read",
    "b2b:write",
    "print:read",
    "print:write",
    "import:write",
    "config:read",
    "config:write",
    "audit:read",
  ],
  DISPATCH_EXECUTIVE: [
    "students:read",
    "payments:read",
    "dispatch:read",
    "dispatch:write",
    "inventory:read",
    "couriers:read",
    "config:read",
    "transfers:read",
    "notifications:read",
    "import:write",
    "reports:read",
  ],
  WAREHOUSE_STAFF: ["inventory:read", "inventory:write"],
  VIEWER_AUDITOR: ["*.read", "reports:export"],
};

export function hasPermission(role: string, permission: string): boolean {
  const perms = ROLE_PERMISSIONS[role] || [];

  // Super Admin override
  if (perms.includes("*")) return true;

  // Exact match
  if (perms.includes(permission)) return true;

  // Check wildcard read (e.g., 'students:read' matches '*.read')
  if (permission.endsWith(":read") && perms.includes("*.read")) return true;

  return false;
}
