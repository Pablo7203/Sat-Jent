/**
 * Admin navigation metadata is filtered by permission codes so users only see links they can open.
 */

import type { PermissionCode } from "@/lib/auth/types";
export type AdminLink = {
  href: string;
  label: string;
  permission: PermissionCode;
};
const adminLinks: AdminLink[] = [
  { href: "/app/admin/users", label: "Employees", permission: "users.read" },
  {
    href: "/app/admin/branches",
    label: "Branches",
    permission: "branches.read",
  },
  {
    href: "/app/admin/access",
    label: "Roles & access",
    permission: "roles.read",
  },
];
export function visibleAdminLinks(permissions: PermissionCode[]): AdminLink[] {
  return adminLinks.filter((link) => permissions.includes(link.permission));
}
