import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { related } from "@/lib/inventory";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
export default async function Page() {
  await requirePermission("inventory.count");
  const s = await createClient();
  const { data: rows } = await s
    .from("stock_counts")
    .select(
      "id,count_number,status,created_at,branch:branches(name),stock_count_items(id)",
    )
    .order("created_at", { ascending: false });
  return (
    <div className="space-y-6">
      <div className="flex justify-between">
        <PageHeader
          title="Stock counts"
          description="Snapshot physical counts and reconcile verified variances."
        />
        <ButtonLink href="/app/inventory/counts/new">New count</ButtonLink>
      </div>
      <div className="space-y-3">
        {rows?.map((x) => (
          <Link href={`/app/inventory/counts/${x.id}`} key={x.id}>
            <Card>
              <div className="flex justify-between">
                <div>
                  <strong>{x.count_number}</strong>
                  <p className="text-sm text-muted-foreground">
                    {related(x.branch)?.name} · {x.stock_count_items.length}{" "}
                    item(s)
                  </p>
                </div>
                <span>{x.status}</span>
              </div>
            </Card>
          </Link>
        ))}
        {!rows?.length ? <Card>No stock counts have been created.</Card> : null}
      </div>
    </div>
  );
}
