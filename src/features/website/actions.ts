"use server";
/**
 * Website actions update public storefront settings after checking the operator's permissions.
 */

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
export async function updateWebsiteSettings(data: FormData) {
  await requirePermission("website.manage");
  const heroTitle = String(data.get("heroTitle") ?? "").trim(),
    heroDescription = String(data.get("heroDescription") ?? "").trim();
  if (
    heroTitle.length < 3 ||
    heroTitle.length > 160 ||
    heroDescription.length < 10 ||
    heroDescription.length > 500
  )
    return;
  await (
    await createClient()
  )
    .from("public_site_settings")
    .update({
      hero_eyebrow: String(data.get("heroEyebrow") ?? "").trim(),
      hero_title: heroTitle,
      hero_description: heroDescription,
      phone: String(data.get("phone") ?? "").trim() || null,
      email: String(data.get("email") ?? "").trim() || null,
      whatsapp_number: String(data.get("whatsapp") ?? "").trim() || null,
    })
    .eq("id", true);
  revalidatePath("/");
  revalidatePath("/contact");
  revalidatePath("/app/admin/website");
}
