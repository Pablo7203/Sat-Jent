import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import {
  DailySalesForm,
  type DailySalesInitialLine,
} from "@/features/daily-sales/forms";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requirePermission("daily_sales.update_draft");
  if (!context.permissions.includes("daily_sales.read"))
    redirect("/access-denied?reason=permission");
  const { id } = await params;
  const db = await createClient();
  const { data: batch } = await db
    .from("daily_sales_batches")
    .select(
      "id,batch_number,branch_id,sales_date,status,entry_kind,entry_reason,correction_of_batch_id,notes",
    )
    .eq("id", id)
    .maybeSingle();
  if (!batch) notFound();
  if (batch.status !== "DRAFT") redirect(`/app/daily-sales/${id}`);
  const branch = context.accessibleBranches.find(
    (item) => item.id === batch.branch_id,
  );
  if (!branch) notFound();

  const { data: rows, error } = await db
    .from("daily_sales_batch_items")
    .select(
      "id,variant_id,quantity,standard_unit_price_snapshot,actual_unit_selling_price,product_name_snapshot,variant_name_snapshot,item_code_snapshot,unit_snapshot",
    )
    .eq("batch_id", id)
    .order("created_at", { ascending: true });
  if (error) throw new Error("Draft product lines could not be loaded.");
  const variantIds = (rows ?? []).map((line) => line.variant_id);
  const [stockResult, unitResult] = variantIds.length
    ? await Promise.all([
        db
          .from("branch_inventory")
          .select("variant_id,quantity_on_hand")
          .eq("branch_id", branch.id)
          .in("variant_id", variantIds),
        db
          .from("product_variants")
          .select(
            "id,product:products!inner(unit:units_of_measure!inner(allows_decimal))",
          )
          .in("id", variantIds),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
      ];
  if (stockResult.error || unitResult.error)
    throw new Error("Draft stock or unit information could not be loaded.");
  const stockByVariant = new Map(
    (stockResult.data ?? []).map((row) => [
      row.variant_id,
      String(row.quantity_on_hand),
    ]),
  );
  const decimalByVariant = new Map(
    ((unitResult.data ?? []) as { id: string; product: unknown }[]).map(
      (row) => {
        const product = row.product as
          | {
              unit: { allows_decimal: boolean } | { allows_decimal: boolean }[];
            }
          | {
              unit: { allows_decimal: boolean } | { allows_decimal: boolean }[];
            }[];
        const p = Array.isArray(product) ? product[0] : product;
        const unit = Array.isArray(p?.unit) ? p.unit[0] : p?.unit;
        return [row.id, unit?.allows_decimal ?? false] as const;
      },
    ),
  );
  const lines: DailySalesInitialLine[] = (rows ?? []).map((line) => ({
    id: line.id,
    variantId: line.variant_id,
    itemCode: line.item_code_snapshot,
    productName: line.product_name_snapshot,
    variantName: line.variant_name_snapshot,
    unit: line.unit_snapshot,
    allowsDecimal: decimalByVariant.get(line.variant_id) ?? false,
    quantity: String(line.quantity),
    standardPrice: String(line.standard_unit_price_snapshot),
    actualPrice: String(line.actual_unit_selling_price),
    available: stockByVariant.get(line.variant_id) ?? "0",
  }));
  const correctionReference = batch.correction_of_batch_id
    ? ((
        await db
          .from("daily_sales_batches")
          .select("batch_number")
          .eq("id", batch.correction_of_batch_id)
          .maybeSingle()
      ).data?.batch_number ?? "original batch")
    : "";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Edit ${batch.batch_number}`}
        description="Update this draft. Stock and revenue are unchanged until a permitted user posts it."
        backHref={`/app/daily-sales/${id}`}
      />
      {batch.correction_of_batch_id ? (
        <Card className="text-sm">
          Correction of reversed batch <strong>{correctionReference}</strong>.
        </Card>
      ) : null}
      <DailySalesForm
        batchId={batch.id}
        branches={context.accessibleBranches
          .filter((item) => item.isActive)
          .map(({ id: branchId, name }) => ({ id: branchId, name }))}
        initialBranchId={batch.branch_id}
        salesDate={batch.sales_date}
        notes={batch.notes ?? ""}
        canBackdate={["OWNER", "SUPER_ADMIN"].includes(context.role.code)}
        canOverride={context.permissions.includes("sales.price_override")}
        initialLines={lines}
        entryKind={batch.entry_kind as "STANDARD" | "ADDITIONAL" | "CORRECTION"}
        entryReason={batch.entry_reason ?? ""}
        correctionOfBatchId={batch.correction_of_batch_id ?? ""}
        correctionReference={correctionReference}
      />
    </div>
  );
}
