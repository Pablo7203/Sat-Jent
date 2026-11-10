import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { related } from "@/lib/inventory";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
export default async function Page() {
  await requirePermission("inventory.adjust");
  const s = await createClient();
  const { data: rows } = await s
    .from("stock_adjustments")
    .select(
      "id,adjustment_number,status,created_at,branch:branches(name),reason:stock_adjustment_reasons(name),stock_adjustment_items(id)",
    )
    .order("created_at", { ascending: false });
  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <PageHeader
          title="Stock adjustments"
          description="Draft, review, and atomically complete manual corrections."
        />
        <ButtonLink href="/app/inventory/adjustments/new">
          New adjustment
        </ButtonLink>
      </div>
      <div className="space-y-3">
        {rows?.map((x) => (
          <Link href={`/app/inventory/adjustments/${x.id}`} key={x.id}>
            <Card>
              <div className="flex justify-between">
                <div>
                  <strong>{x.adjustment_number}</strong>
                  <p className="text-sm text-muted-foreground">
                    {related(x.branch)?.name} · {related(x.reason)?.name} ·{" "}
                    {x.stock_adjustment_items.length} item(s)
                  </p>
                </div>
                <span>{x.status}</span>
              </div>
            </Card>
          </Link>
        ))}
        {!rows?.length ? <Card>No adjustments found.</Card> : null}
      </div>
    </div>
  );
}
