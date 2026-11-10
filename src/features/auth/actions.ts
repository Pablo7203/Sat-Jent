"use server";
/**
 * Authentication actions cover sign-in, sign-out, and password recovery; internal access is checked before entering the protected app.
 */

import { redirect } from "next/navigation";
import { z } from "zod";
import { loginSchema } from "@/features/auth/schema";
import { hasPublicSupabaseEnv } from "@/lib/env/public";
import { passwordSetupCallbackUrl } from "@/lib/env/site-url";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { message?: string; success: boolean };
const emailSchema = z.email("Enter a valid email address.");
const passwordSchema = z
  .string()
  .min(12, "Use at least 12 characters for the new password.");

async function hasInternalAccess(userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_active, role_id")
    .eq("id", userId)
    .eq("is_active", true)
    .maybeSingle();
  if (!profile?.role_id) return false;
  const { data: permissions } = await supabase.rpc("current_permission_codes");
  return (permissions ?? []).some(
    (permission: { code: string }) => permission.code === "app.access",
  );
}

export async function login(
  _previous: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const values = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!values.success)
    return {
      success: false,
      message: values.error.issues[0]?.message ?? "Check your details.",
    };
  if (!hasPublicSupabaseEnv())
    return {
      success: false,
      message: "Authentication is not configured in this environment yet.",
    };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(values.data);
  if (error || !data.user)
    return { success: false, message: "The email or password is incorrect." };
  if (!(await hasInternalAccess(data.user.id)))
    redirect("/access-denied?reason=account");
  redirect("/app");
}

export async function requestPasswordReset(
  _previous: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = emailSchema.safeParse(formData.get("email"));
  if (!email.success)
    return { success: false, message: email.error.issues[0]?.message };
  if (hasPublicSupabaseEnv()) {
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(email.data, {
      redirectTo: passwordSetupCallbackUrl(),
    });
  }
  return {
    success: true,
    message:
      "If an account exists for that email, recovery instructions will be sent.",
  };
}

export async function updatePassword(
  _previous: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const password = passwordSchema.safeParse(formData.get("password"));
  if (!password.success)
    return { success: false, message: password.error.issues[0]?.message };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error)
    return {
      success: false,
      message:
        "The password could not be updated. Request a new recovery link and try again.",
    };
  const { error: onboardingError } = await supabase.rpc(
    "complete_employee_onboarding",
  );
  if (onboardingError)
    return {
      success: false,
      message:
        "Your password was saved, but employee access could not be activated. Contact an administrator.",
    };
  await supabase.auth.signOut();
  redirect("/login?reset=success");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
