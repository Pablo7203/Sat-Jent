"use server";
/**
 * Staff quotation actions perform permission-checked status changes for submitted requests.
 */

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
export async function changeQuotationStatus(data: FormData) {
  await requirePermission("quotations.update");
  const id = String(data.get("id") ?? ""),
    status = String(data.get("status") ?? "");
  if (
    !/^[0-9a-f-]{36}$/i.test(id) ||
    !["NEW", "CONTACTED", "IN_PROGRESS", "CLOSED", "CANCELLED"].includes(status)
  )
    return;
  await (
    await createClient()
  ).rpc("update_quotation_status", { target_id: id, new_status: status });
  revalidatePath("/app/quotations");
  revalidatePath(`/app/quotations/${id}`);
}
