import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { formatGhs } from "@/lib/format";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
function related<T>(value: T | T[] | null): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}
export default async function Page() {
  await requirePermission("product_prices.read");
  const s = await createClient();
  const { data: prices } = await s
    .from("product_prices")
    .select(
      "id,amount,currency,price_type,effective_from,effective_to,branch:branches(name),variant:product_variants(id,name,sku,product:products(id,name))",
    )
    .order("effective_from", { ascending: false })
    .limit(100);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Price history"
        description="Effective-dated GHS retail and wholesale prices. Current records have no end date."
      />
      <div className="space-y-3">
        {prices?.map((p) => {
          const variant = related(p.variant);
          const product = variant ? related(variant.product) : null;
          const branch = related(p.branch);
          return (
            <Card key={p.id}>
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <Link
                    className="font-bold text-primary"
                    href={`/app/products/${product?.id}`}
                  >
                    {product?.name}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {variant?.name} · Item Code {variant?.sku} ·{" "}
                    {branch?.name ?? "Company-wide"}
                  </p>
                </div>
                <div className="text-right">
                  <strong>{formatGhs(p.amount)}</strong>
                  <p className="text-xs text-muted-foreground">
                    {p.price_type} · {p.effective_to ? "Historical" : "Current"}
                  </p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
