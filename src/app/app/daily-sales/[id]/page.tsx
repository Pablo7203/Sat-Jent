import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  PostDailySalesForm,
  ReverseDailySalesForm,
} from "@/features/daily-sales/forms";
import { requirePermission } from "@/lib/auth/authorization";
import { formatGhs } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

const businessDate = (value: string) =>
  new Date(`${value}T00:00:00Z`).toLocaleDateString("en-GH", {
    dateStyle: "long",
    timeZone: "Africa/Accra",
  });

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requirePermission("daily_sales.read");
  const { id } = await params;
  const db = await createClient();
  const { data: batch } = await db
    .from("daily_sales_statement")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!batch) notFound();

  const { data: lines } = await db
    .from("daily_sales_batch_items")
    .select("*")
    .eq("batch_id", id)
    .order("created_at", { ascending: true });
  const lineIds = (lines ?? []).flatMap((line) =>
    [line.stock_movement_id, line.reversal_movement_id].filter(
      (movementId): movementId is string => Boolean(movementId),
    ),
  );
  const { data: movements } = lineIds.length
    ? await db
        .from("stock_movements")
        .select(
          "id,occurred_at,movement_type,quantity_delta,balance_before,balance_after",
        )
        .in("id", lineIds)
    : { data: [] };
  const movementById = new Map(
    (movements ?? []).map((movement) => [movement.id, movement]),
  );
  const canEdit =
    batch.status === "DRAFT" &&
    context.permissions.includes("daily_sales.update_draft");
  const canPost =
    batch.status === "DRAFT" &&
    context.permissions.includes("daily_sales.post");
  const canReverse =
    batch.status === "POSTED" &&
    context.permissions.includes("daily_sales.reverse");

  return (
    <div className="space-y-6">
      <PageHeader
        title={batch.batch_number}
        description={`${batch.branch_name} · Sales date ${businessDate(batch.sales_date)} · ${batch.status.toLowerCase()}`}
        backHref="/app/daily-sales"
      />

      {batch.entry_kind !== "STANDARD" ? (
        <Card className="space-y-1">
          <p className="text-sm font-semibold">
            {batch.entry_kind === "ADDITIONAL"
              ? "Additional batch"
              : "Correction batch"}
          </p>
          <p className="text-sm text-muted-foreground">
            {batch.entry_kind === "ADDITIONAL"
              ? batch.entry_reason
              : batch.correction_of_batch_id
                ? `Replacement for a reversed batch.`
                : "Correction batch"}
          </p>
          {batch.correction_of_batch_id ? (
            <Link
              className="inline-flex items-center gap-1 text-sm font-medium underline"
              href={`/app/daily-sales/${batch.correction_of_batch_id}`}
            >
              View original reversed batch{" "}
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </Link>
          ) : null}
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Status", batch.status],
          ["Product lines", String(batch.line_count)],
          ["Daily sales revenue", formatGhs(batch.total_revenue)],
          [
            "Created",
            new Date(batch.created_at).toLocaleString("en-GH", {
              timeZone: "Africa/Accra",
            }),
          ],
        ].map(([label, value]) => (
          <Card key={label} className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p className="font-semibold tabular-nums">{value}</p>
          </Card>
        ))}
      </div>

      {batch.notes ? (
        <Card>
          <h2 className="font-semibold">Batch notes</h2>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
            {batch.notes}
          </p>
        </Card>
      ) : null}

      <Card className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Sales lines</h2>
          <p className="text-sm text-muted-foreground">
            These are revenue records, not payment or customer-account records.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="border-b text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="py-3 pr-4">Product</th>
                <th className="py-3 pr-4">Quantity</th>
                <th className="py-3 pr-4">Standard price</th>
                <th className="py-3 pr-4">Actual price</th>
                <th className="py-3 pr-4 text-right">Line revenue</th>
                <th className="py-3">Stock movement</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {(lines ?? []).map((line, index) => {
                const movement = line.stock_movement_id
                  ? movementById.get(line.stock_movement_id)
                  : null;
                const reversal = line.reversal_movement_id
                  ? movementById.get(line.reversal_movement_id)
                  : null;
                return (
                  <tr key={line.id}>
                    <td className="py-3 pr-4">
                      <p className="font-medium">
                        {line.product_name_snapshot}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {line.variant_name_snapshot} · {line.item_code_snapshot}
                      </p>
                    </td>
                    <td className="py-3 pr-4 tabular-nums">
                      {line.quantity} {line.unit_snapshot}
                    </td>
                    <td className="py-3 pr-4 tabular-nums">
                      {formatGhs(line.standard_unit_price_snapshot)}
                    </td>
                    <td className="py-3 pr-4 tabular-nums">
                      {formatGhs(line.actual_unit_selling_price)}
                    </td>
                    <td className="py-3 pr-4 text-right font-semibold tabular-nums">
                      {formatGhs(line.line_total)}
                    </td>
                    <td className="py-3">
                      {movement ? (
                        <span className="text-xs text-muted-foreground">
                          {movement.quantity_delta} ·{" "}
                          {new Date(movement.occurred_at).toLocaleString(
                            "en-GH",
                            { timeZone: "Africa/Accra" },
                          )}
                          {reversal ? (
                            <>
                              <br />
                              Restored {reversal.quantity_delta} ·{" "}
                              {new Date(reversal.occurred_at).toLocaleString(
                                "en-GH",
                                { timeZone: "Africa/Accra" },
                              )}
                            </>
                          ) : null}
                        </span>
                      ) : batch.status === "DRAFT" ? (
                        <span className="text-xs text-muted-foreground">
                          Not posted
                        </span>
                      ) : (
                        <span className="text-xs text-destructive">
                          Movement missing · line {index + 1}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2">
                <th colSpan={4} className="py-3 text-right">
                  Total revenue
                </th>
                <th className="py-3 text-right text-base tabular-nums">
                  {formatGhs(batch.total_revenue)}
                </th>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        {!lines?.length ? (
          <p className="text-sm text-muted-foreground">
            No product lines have been added to this draft.
          </p>
        ) : null}
      </Card>

      {batch.status === "REVERSED" ? (
        <Card className="space-y-2 border-destructive/30">
          <h2 className="font-semibold">Reversal recorded</h2>
          <p className="text-sm text-muted-foreground">
            {batch.reversal_reason}
          </p>
          <p className="text-xs text-muted-foreground">
            {batch.reversed_at
              ? new Date(batch.reversed_at).toLocaleString("en-GH", {
                  timeZone: "Africa/Accra",
                })
              : ""}
          </p>
          {!batch.replacement_batch_id &&
          context.permissions.includes("daily_sales.create") ? (
            <ButtonLink
              href={`/app/daily-sales/new?correctionOf=${batch.id}`}
              variant="secondary"
              size="compact"
            >
              <RotateCcw aria-hidden="true" className="size-4" /> Prepare
              corrected batch
            </ButtonLink>
          ) : batch.replacement_batch_id ? (
            <Link
              className="inline-flex items-center gap-1 text-sm font-medium underline"
              href={`/app/daily-sales/${batch.replacement_batch_id}`}
            >
              View replacement batch{" "}
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </Link>
          ) : null}
        </Card>
      ) : null}

      {canEdit || canPost || canReverse ? (
        <Card className="space-y-4">
          <h2 className="font-semibold">Batch actions</h2>
          <div className="flex flex-wrap items-start gap-5">
            {canEdit ? (
              <ButtonLink
                href={`/app/daily-sales/${batch.id}/edit`}
                variant="secondary"
                size="compact"
              >
                Edit draft
              </ButtonLink>
            ) : null}
            {canPost ? (
              <PostDailySalesForm
                batchId={batch.id}
                batchNumber={batch.batch_number}
                salesDate={batch.sales_date}
                branchName={batch.branch_name}
                lineCount={Number(batch.line_count)}
                totalRevenue={String(batch.total_revenue)}
              />
            ) : null}
            {canReverse ? <ReverseDailySalesForm batchId={batch.id} /> : null}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
