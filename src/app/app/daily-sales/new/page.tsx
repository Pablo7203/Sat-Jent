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
  searchParams,
}: {
  searchParams: Promise<{ correctionOf?: string }>;
}) {
  const context = await requirePermission("daily_sales.create");
  if (!context.permissions.includes("daily_sales.read"))
    redirect("/access-denied?reason=permission");
  const { correctionOf = "" } = await searchParams;
  const branches = context.accessibleBranches.filter(
    (branch) => branch.isActive,
  );
  if (!branches.length) {
    return (
      <div className="space-y-6">
        <PageHeader title="Record daily sales" />
        <Card>
          You need an active authorized branch to create a daily batch.
        </Card>
      </div>
    );
  }

  let initialBranchId = branches.length === 1 ? branches[0].id : "";
  let initialDate: string | undefined;
  let correctionReference = "";
  let initialLines: DailySalesInitialLine[] = [];

  if (correctionOf) {
    const client = await createClient();
    const { data: original } = await client
      .from("daily_sales_batches")
      .select(
        "id,batch_number,branch_id,sales_date,status,replacement_batch_id",
      )
      .eq("id", correctionOf)
      .maybeSingle();
    if (
      !original ||
      original.status !== "REVERSED" ||
      original.replacement_batch_id ||
      !branches.some((branch) => branch.id === original.branch_id)
    )
      notFound();
    initialBranchId = original.branch_id;
    initialDate = original.sales_date;
    correctionReference = original.batch_number;
    const { data: originalLines } = await client
      .from("daily_sales_batch_items")
      .select(
        "id,variant_id,quantity,standard_unit_price_snapshot,actual_unit_selling_price,product_name_snapshot,variant_name_snapshot,item_code_snapshot,unit_snapshot",
      )
      .eq("batch_id", original.id)
      .order("created_at");
    const variantIds = (originalLines ?? []).map((line) => line.variant_id);
    const stockResult = variantIds.length
      ? await client
          .from("branch_inventory")
          .select("variant_id,quantity_on_hand")
          .eq("branch_id", original.branch_id)
          .in("variant_id", variantIds)
      : null;
    const unitsResult = variantIds.length
      ? await client
          .from("product_variants")
          .select(
            "id,product:products!inner(unit:units_of_measure!inner(allows_decimal))",
          )
          .in("id", variantIds)
      : null;
    const stock = stockResult?.data ?? [];
    const units = unitsResult?.data ?? [];
    const stockByVariant = new Map(
      (stock ?? []).map((row) => [
        row.variant_id,
        String(row.quantity_on_hand),
      ]),
    );
    const decimalByVariant = new Map(
      ((units ?? []) as { id: string; product: unknown }[]).map((row) => {
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
      }),
    );
    initialLines = (originalLines ?? []).map((line) => ({
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
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={
          correctionOf ? "Prepare corrected daily sales" : "Record daily sales"
        }
        description="Choose the branch and sales date, add each product sold, then save this as an editable draft. Nothing is deducted from stock until posting."
        backHref="/app/daily-sales"
      />
      <DailySalesForm
        branches={branches.map(({ id, name }) => ({ id, name }))}
        initialBranchId={initialBranchId}
        salesDate={initialDate}
        canBackdate={["OWNER", "SUPER_ADMIN"].includes(context.role.code)}
        canOverride={context.permissions.includes("sales.price_override")}
        initialLines={initialLines}
        entryKind={correctionOf ? "CORRECTION" : "STANDARD"}
        correctionOfBatchId={correctionOf}
        correctionReference={correctionReference}
      />
    </div>
  );
}
