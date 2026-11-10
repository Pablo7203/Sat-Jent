"use server";
/**
 * Branch and employee administration actions. Permission checks run before branch changes, invitations, or access updates.
 */

import { revalidatePath } from "next/cache";
import {
  branchSchema,
  employeeSchema,
  accessSchema,
} from "@/features/admin/schemas";
import { requirePermission } from "@/lib/auth/authorization";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { passwordSetupCallbackUrl } from "@/lib/env/site-url";
import { sendAccessUpdatedEmail } from "@/lib/email/access-notification";

export type ActionState = { success: boolean; message?: string };
const branchesFrom = (formData: FormData) =>
  formData
    .getAll("branchIds")
    .filter((value): value is string => typeof value === "string");

export async function createBranch(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("branches.manage");
  const values = branchSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    address: formData.get("address"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    openingHours: formData.get("openingHours"),
  });
  if (!values.success)
    return { success: false, message: values.error.issues[0]?.message };
  const supabase = await createClient();
  const { error } = await supabase.from("branches").insert({
    code: values.data.code,
    name: values.data.name,
    address: values.data.address,
    phone: values.data.phone,
    email: values.data.email || null,
    opening_hours: values.data.openingHours || null,
  });
  if (error)
    return {
      success: false,
      message:
        "The branch could not be created. Check that its code is unique.",
    };
  revalidatePath("/app/admin/branches");
  return { success: true, message: "Branch created." };
}

export async function setBranchActive(formData: FormData) {
  await requirePermission("branches.manage");
  const id = formData.get("id");
  const active = formData.get("active") === "true";
  if (typeof id !== "string") return;
  const parsed = accessSchema.shape.userId.safeParse(id);
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase
    .from("branches")
    .update({ is_active: active })
    .eq("id", parsed.data);
  revalidatePath("/app/admin/branches");
}

export async function updateBranch(formData: FormData) {
  await requirePermission("branches.manage");
  const id = accessSchema.shape.userId.safeParse(formData.get("id"));
  const values = branchSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    address: formData.get("address"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    openingHours: formData.get("openingHours"),
  });
  if (!id.success || !values.success) return;
  const supabase = await createClient();
  await supabase
    .from("branches")
    .update({
      code: values.data.code,
      name: values.data.name,
      address: values.data.address,
      phone: values.data.phone,
      email: values.data.email || null,
      opening_hours: values.data.openingHours || null,
      is_public: formData.get("isPublic") === "on",
    })
    .eq("id", id.data);
  revalidatePath("/app/admin/branches");
}

export async function inviteEmployee(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requirePermission("users.manage");
  const values = employeeSchema.safeParse({
    email: formData.get("email"),
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    roleId: formData.get("roleId"),
    branchIds: branchesFrom(formData),
  });
  if (!values.success)
    return { success: false, message: values.error.issues[0]?.message };
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return {
      success: false,
      message: "Employee invitation requires server administrator credentials.",
    };
  }
  const { data, error } = await admin.auth.admin.inviteUserByEmail(
    values.data.email,
    {
      data: { full_name: values.data.fullName, phone: values.data.phone },
      redirectTo: passwordSetupCallbackUrl(),
    },
  );
  if (error || !data.user)
    return {
      success: false,
      message:
        "The invitation could not be sent. Verify email delivery configuration and whether the account already exists.",
    };
  const supabase = await createClient();
  const { error: configError } = await supabase.rpc(
    "configure_employee_access",
    {
      target_user_id: data.user.id,
      target_role_id: values.data.roleId,
      target_branch_ids: values.data.branchIds,
      target_active: false,
    },
  );
  if (configError)
    return {
      success: false,
      message:
        "The account was invited but remains inactive because access configuration failed.",
    };
  revalidatePath("/app/admin/users");
  return {
    success: true,
    message:
      "Invitation sent. The employee will appear after setting a password.",
  };
}

export async function resendEmployeeInvitation(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await requirePermission("users.manage");
  if (context.role.code !== "SUPER_ADMIN")
    return {
      success: false,
      message: "Only a Super Admin may resend invitations.",
    };
  const userId = accessSchema.shape.userId.safeParse(formData.get("userId"));
  if (!userId.success)
    return { success: false, message: "Invalid invitation." };

  const supabase = await createClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,onboarding_completed_at")
    .eq("id", userId.data)
    .maybeSingle();
  if (profileError || !profile || profile.onboarding_completed_at)
    return {
      success: false,
      message: "This invitation is no longer awaiting confirmation.",
    };

  try {
    const admin = createAdminClient();
    const { data: userData, error: userError } =
      await admin.auth.admin.getUserById(userId.data);
    if (userError || !userData.user?.email)
      return {
        success: false,
        message: "The invited account could not be found.",
      };
    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      userData.user.email,
      { redirectTo: passwordSetupCallbackUrl() },
    );
    if (inviteError)
      return {
        success: false,
        message:
          "The invitation could not be resent. Check the email delivery settings and try again.",
      };
  } catch {
    return {
      success: false,
      message: "The invitation could not be resent from this server.",
    };
  }

  revalidatePath("/app/admin/users");
  return { success: true, message: "A new invitation email has been sent." };
}

export async function configureEmployee(formData: FormData) {
  await requirePermission("users.manage");
  const values = accessSchema.safeParse({
    userId: formData.get("userId"),
    roleId: formData.get("roleId"),
    branchIds: branchesFrom(formData),
    isActive: formData.get("isActive") === "true",
  });
  if (!values.success) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc("configure_employee_access", {
    target_user_id: values.data.userId,
    target_role_id: values.data.roleId,
    target_branch_ids: values.data.branchIds,
    target_active: values.data.isActive,
  });
  if (error) return;
  const [{ data: profile }, { data: role }, { data: branchRows }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name")
        .eq("id", values.data.userId)
        .single(),
      supabase
        .from("roles")
        .select("name")
        .eq("id", values.data.roleId)
        .single(),
      values.data.branchIds.length
        ? supabase
            .from("branches")
            .select("name")
            .in("id", values.data.branchIds)
            .order("name")
        : Promise.resolve({ data: [] as { name: string }[] }),
    ]);
  try {
    const { data } = await createAdminClient().auth.admin.getUserById(
      values.data.userId,
    );
    if (data.user?.email)
      await sendAccessUpdatedEmail({
        to: data.user.email,
        employeeName: profile?.full_name ?? "",
        roleName: role?.name ?? "Updated role",
        branchNames: (branchRows ?? []).map((branch) => branch.name),
        isActive: values.data.isActive,
      });
  } catch (notificationError) {
    console.error(
      "Employee access updated but notification failed",
      notificationError,
    );
  }
  revalidatePath("/app/admin/users");
}

export async function deleteEmployee(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const context = await requirePermission("users.manage");
  if (context.role.code !== "SUPER_ADMIN")
    return { success: false, message: "Only a Super Admin may delete users." };
  const userId = accessSchema.shape.userId.safeParse(formData.get("userId"));
  if (!userId.success || userId.data === context.user.id)
    return { success: false, message: "This employee cannot be deleted." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_employee_account", {
    target_user_id: userId.data,
  });
  if (error)
    return {
      success: false,
      message: error.message.includes("foreign key")
        ? "This employee has retained business history. Deactivate the account instead."
        : "The employee could not be deleted.",
    };
  revalidatePath("/app/admin/users");
  return { success: true, message: "Employee permanently deleted." };
}
