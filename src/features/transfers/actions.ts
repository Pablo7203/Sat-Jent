"use server";
/**
 * Transfer actions share lifecycle checks for requests, approvals, dispatch, receipt, and cancellation across branches.
 */

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

export type TransferState = { error?: string; success?: string };
const uuid = z.string().uuid();
const value = (data: FormData, key: string) => String(data.get(key) ?? "");
const friendly = (raw: string) => {
  if (raw.includes("not enough stock"))
    return "There is not enough stock at the source branch to dispatch this transfer.";
  if (raw.includes("destination branch"))
    return "Only the destination branch can confirm receipt.";
  if (raw.includes("dispatched transfer cannot"))
    return "A dispatched transfer cannot be cancelled.";
  if (raw.includes("Source and destination"))
    return "Source and destination branches must be different.";
  if (raw.includes("permission") || raw.includes("authorized"))
    return "You do not have access to perform this transfer action.";
  if (raw.includes("approved transfer"))
    return "This transfer is not approved for dispatch.";
  if (raw.includes("dispatched transfer"))
    return "This transfer is not awaiting receipt.";
  return "The transfer operation could not be completed. Refresh and try again.";
};

export async function saveTransfer(
  _state: TransferState,
  data: FormData,
): Promise<TransferState> {
  await requirePermission("transfers.create");
  const source = uuid.safeParse(data.get("sourceBranchId"));
  const destination = uuid.safeParse(data.get("destinationBranchId"));
  const id = uuid.safeParse(data.get("id"));
  const variants = data.getAll("variantId").map(String);
  const quantities = data.getAll("quantity").map(String);
  const itemNotes = data.getAll("itemNotes").map(String);
  const items = variants
    .map((variant_id, index) => ({
      variant_id,
      quantity: quantities[index],
      notes: itemNotes[index] ?? "",
    }))
    .filter(
      (item) =>
        uuid.safeParse(item.variant_id).success && Number(item.quantity) > 0,
    );
  if (!source.success || !destination.success || !items.length)
    return {
      error:
        "Choose different source and destination branches and at least one item.",
    };
  if (source.data === destination.data)
    return { error: "Source and destination branches must be different." };
  const client = await createClient();
  const result = id.success
    ? await client.rpc("update_draft_transfer", {
        target_transfer: id.data,
        target_source: source.data,
        target_destination: destination.data,
        transfer_notes: value(data, "notes"),
        items,
      })
    : await client.rpc("create_transfer", {
        target_source: source.data,
        target_destination: destination.data,
        transfer_notes: value(data, "notes"),
        submit_now: value(data, "intent") === "submit",
        items,
      });
  if (result.error) return { error: friendly(result.error.message) };
  redirect(`/app/transfers/${id.success ? id.data : result.data}`);
}

async function lifecycle(
  data: FormData,
  permission:
    | "transfers.create"
    | "transfers.approve"
    | "transfers.dispatch"
    | "transfers.receive"
    | "transfers.cancel",
  rpc: string,
) {
  await requirePermission(permission);
  const id = uuid.safeParse(data.get("id"));
  if (!id.success) return;
  const client = await createClient();
  const args =
    rpc === "dispatch_transfer" || rpc === "receive_transfer"
      ? { target_transfer: id.data, operation_id: randomUUID() }
      : rpc === "cancel_transfer"
        ? { target_transfer: id.data, reason: value(data, "reason") }
        : { target_transfer: id.data };
  const { error } = await client.rpc(rpc, args);
  if (error)
    redirect(
      `/app/transfers/${id.data}?error=${encodeURIComponent(friendly(error.message))}`,
    );
  revalidatePath("/app/transfers", "layout");
  revalidatePath("/app/inventory", "layout");
  redirect(`/app/transfers/${id.data}?updated=${randomUUID()}`);
}
export async function requestTransfer(data: FormData) {
  return lifecycle(data, "transfers.create", "request_transfer");
}
export async function approveTransfer(data: FormData) {
  return lifecycle(data, "transfers.approve", "approve_transfer");
}
export async function dispatchTransfer(data: FormData) {
  return lifecycle(data, "transfers.dispatch", "dispatch_transfer");
}
export async function receiveTransfer(data: FormData) {
  return lifecycle(data, "transfers.receive", "receive_transfer");
}
export async function cancelTransfer(data: FormData) {
  return lifecycle(data, "transfers.cancel", "cancel_transfer");
}
