import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { TransferForm } from "@/features/transfers/forms";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

export default async function EditTransferPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("transfers.create");
  const { id } = await params;
  const client = await createClient();
  const [
    { data: transfer },
    { data: items },
    { data: branches },
    { data: variants },
  ] = await Promise.all([
    client
      .from("stock_transfers")
      .select("id,source_branch_id,destination_branch_id,status,notes")
      .eq("id", id)
      .maybeSingle(),
    client
      .from("stock_transfer_items")
      .select("variant_id,requested_quantity,notes")
      .eq("transfer_id", id)
      .order("created_at"),
    client.rpc("active_transfer_branches"),
    client
      .from("product_variants")
      .select("id,sku,name,product:products!inner(name,status)")
      .eq("is_active", true)
      .eq("product.status", "ACTIVE")
      .order("sku"),
  ]);
  if (!transfer || transfer.status !== "DRAFT") notFound();
  const branchRows = (branches ?? []) as {
    id: string;
    code: string;
    name: string;
  }[];
  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit ${id.slice(0, 8)}`}
        description="Only draft transfers can be edited."
      />
      <Card>
        <TransferForm
          transfer={transfer}
          items={items ?? []}
          branches={branchRows.map((b) => ({
            id: b.id,
            label: `${b.code} — ${b.name}`,
          }))}
          variants={(variants ?? []).map((v) => ({
            id: v.id,
            label: `Item Code ${v.sku} — ${(v.product as unknown as { name: string }).name} / ${v.name}`,
          }))}
        />
      </Card>
    </div>
  );
}
