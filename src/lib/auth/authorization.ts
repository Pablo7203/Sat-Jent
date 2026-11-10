/**
 * Central authorization boundary for employee routes and server actions. It resolves the active profile and branch context before permission checks.
 */

import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { hasPublicSupabaseEnv } from "@/lib/env/public";
import type {
  AccessFailure,
  EmployeeContext,
  PermissionCode,
  RoleCode,
  RoleScope,
} from "@/lib/auth/types";

type Result =
  | { context: EmployeeContext; failure?: never }
  | { context?: never; failure: AccessFailure | "anonymous" };

export const getEmployeeAccess = cache(async (): Promise<Result> => {
  if (!hasPublicSupabaseEnv()) return { failure: "anonymous" };
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) return { failure: "anonymous" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone, role_id, is_active")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) return { failure: "missing-profile" };
  if (!profile.is_active) return { failure: "inactive" };
  if (!profile.role_id) return { failure: "missing-role" };

  const { data: role } = await supabase
    .from("roles")
    .select("id, code, name, scope")
    .eq("id", profile.role_id)
    .maybeSingle();
  if (!role) return { failure: "missing-role" };
  const { data: permissionRows } = await supabase.rpc(
    "current_permission_codes",
  );
  const permissions = ((permissionRows ?? []) as { code: string }[]).map(
    (row) => row.code as PermissionCode,
  );
  if (!permissions.includes("app.access"))
    return { failure: "missing-permission" };

  const branchesQuery =
    role.scope === "COMPANY"
      ? supabase
          .from("branches")
          .select("id, code, name, is_active")
          .order("name")
      : supabase
          .from("user_branches")
          .select("branches(id, code, name, is_active)")
          .eq("user_id", userId)
          .eq("is_active", true);
  const { data: branchRows } = await branchesQuery;
  const accessibleBranches = (branchRows ?? []).flatMap((row) => {
    const branch = ("branches" in row ? row.branches : row) as unknown as {
      id: string;
      code: string;
      name: string;
      is_active: boolean;
    } | null;
    return branch
      ? [
          {
            id: branch.id,
            code: branch.code,
            name: branch.name,
            isActive: branch.is_active,
          },
        ]
      : [];
  });

  return {
    context: {
      user: {
        id: userId,
        email:
          typeof claimsData.claims.email === "string"
            ? claimsData.claims.email
            : "",
      },
      profile: {
        fullName: profile.full_name,
        phone: profile.phone,
        isActive: profile.is_active,
      },
      role: {
        id: role.id,
        code: role.code as RoleCode,
        name: role.name,
        scope: role.scope as RoleScope,
      },
      permissions,
      accessibleBranches,
    },
  };
});

export async function requireActiveProfile(): Promise<EmployeeContext> {
  const result = await getEmployeeAccess();
  if (result.failure === "anonymous") redirect("/login");
  if (!result.context) redirect(`/access-denied?reason=${result.failure}`);
  return result.context;
}

export async function requirePermission(
  permission: PermissionCode,
): Promise<EmployeeContext> {
  const context = await requireActiveProfile();
  if (!context.permissions.includes(permission))
    redirect("/access-denied?reason=permission");
  return context;
}

export async function requireBranchAccess(
  branchId: string,
): Promise<EmployeeContext> {
  const context = await requireActiveProfile();
  if (
    context.role.scope !== "COMPANY" &&
    !context.accessibleBranches.some((branch) => branch.id === branchId)
  )
    redirect("/access-denied?reason=branch");
  return context;
}
