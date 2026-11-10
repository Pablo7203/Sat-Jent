"use server";
/**
 * Profile actions update an employee's own details without changing their role or branch assignments.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireActiveProfile } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

export type ProfileState = { success: boolean; message?: string };

const profileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Enter your full name.")
    .max(160, "Your name must be 160 characters or fewer."),
  phone: z
    .string()
    .trim()
    .max(40, "Your phone number must be 40 characters or fewer."),
});

export async function updateOwnProfile(
  _previous: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const context = await requireActiveProfile();
  const parsed = profileSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone") ?? "",
  });
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Check your profile details.",
    };
  }

  const { error } = await (
    await createClient()
  )
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      phone: parsed.data.phone || null,
    })
    .eq("id", context.user.id);
  if (error) {
    return { success: false, message: "Your profile could not be updated." };
  }

  revalidatePath("/app", "layout");
  revalidatePath("/app/profile");
  return { success: true, message: "Your profile has been updated." };
}
