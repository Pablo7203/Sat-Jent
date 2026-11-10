import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatQuantity } from "@/lib/inventory";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
import { ProductLookup } from "@/features/inventory/product-lookup";
export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const context = await requirePermission("inventory.read");
  const q = await searchParams,
    page = Math.max(1, Number(q.page) || 1),
    size = 25;
  const s = await createClient();
  let request = s.from("inventory_catalog").select("*", { count: "exact" });
  const searchTerm = (q.q ?? "").replace(/[^\p{L}\p{N}\s._-]/gu, " ").trim();
  if (searchTerm)
    request = request.or(
      `product_name.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%,barcode.ilike.%${searchTerm}%,brand_name.ilike.%${searchTerm}%`,
    );
  if (q.branch) request = request.eq("branch_id", q.branch);
  if (q.status) request = request.eq("stock_status", q.status);
  if (q.category) request = request.eq("category_id", q.category);
  if (q.brand) request = request.eq("brand_id", q.brand);
  const { data: rows, count } = await request
    .order("product_name")
    .range((page - 1) * size, page * size - 1);
  const [{ data: categories }, { data: brands }, { data: transit }] =
    await Promise.all([
      s.from("categories").select("id,name").order("name"),
      s.from("brands").select("id,name").order("name"),
      context.permissions.includes("transfers.read")
        ? s.from("transfer_in_transit").select("in_transit_quantity")
        : Promise.resolve({ data: [] }),
    ]);
  const inTransit = (transit ?? []).reduce(
    (total, row) => total + Number(row.in_transit_quantity),
    0,
  );
  const summary = (rows ?? []).reduce(
    (a, x) => ({ ...a, [x.stock_status]: (a[x.stock_status] ?? 0) + 1 }),
    {} as Record<string, number>,
  );
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageHeader
          title="Inventory"
          description="Branch balances derived from an immutable stock ledger."
        />
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/app/inventory/movements" variant="secondary">
            Movements
          </ButtonLink>
          {context.permissions.includes("inventory.opening_stock") ? (
            <ButtonLink href="/app/inventory/opening-stock">
              Opening stock
            </ButtonLink>
          ) : null}
          {context.permissions.includes("inventory.adjust") ? (
            <ButtonLink href="/app/inventory/adjustments" variant="secondary">
              Adjustments
            </ButtonLink>
          ) : null}
          {context.permissions.includes("inventory.count") ? (
            <ButtonLink href="/app/inventory/counts" variant="secondary">
              Stock counts
            </ButtonLink>
          ) : null}
        </div>
      </div>
      <ProductLookup
        branches={context.accessibleBranches
          .filter((branch) => branch.isActive)
          .map((branch) => ({ id: branch.id, name: branch.name }))}
        initialBranchId={
          context.accessibleBranches.some(
            (branch) => branch.id === q.branch && branch.isActive,
          )
            ? q.branch
            : ""
        }
      />
      <div className="grid gap-3 sm:grid-cols-4">
        <Card>
          <strong>{count ?? 0}</strong>
          <p className="text-sm text-muted-foreground">
            Initialized branch item positions
          </p>
        </Card>
        <Card>
          <strong>{summary.LOW_STOCK ?? 0}</strong>
          <p className="text-sm text-muted-foreground">
            Low stock in this page
          </p>
        </Card>
        <Card>
          <strong>{summary.OUT_OF_STOCK ?? 0}</strong>
          <p className="text-sm text-muted-foreground">
            Out of stock in this page
          </p>
        </Card>
        <Card>
          <strong>{inTransit}</strong>
          <p className="text-sm text-muted-foreground">
            Units in transit (not available)
          </p>
        </Card>
      </div>
      <Card>
        <form className="grid gap-3 md:grid-cols-6">
          <Input
            name="q"
            defaultValue={q.q}
            placeholder="Product, Item Code, barcode or brand"
          />
          <select
            name="branch"
            defaultValue={q.branch}
            className="min-h-11 rounded-lg border bg-surface px-3"
          >
            <option value="">All authorized branches</option>
            {context.accessibleBranches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
          <select
            name="category"
            defaultValue={q.category}
            className="min-h-11 rounded-lg border bg-surface px-3"
          >
            <option value="">All categories</option>
            {categories?.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
          <select
            name="brand"
            defaultValue={q.brand}
            className="min-h-11 rounded-lg border bg-surface px-3"
          >
            <option value="">All brands</option>
            {brands?.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
          <select
            name="status"
            defaultValue={q.status}
            className="min-h-11 rounded-lg border bg-surface px-3"
          >
            <option value="">All statuses</option>
            <option value="IN_STOCK">In stock</option>
            <option value="LOW_STOCK">Low stock</option>
            <option value="OUT_OF_STOCK">Out of stock</option>
          </select>
          <button className="rounded-lg bg-primary px-4 font-semibold text-primary-foreground">
            Search
          </button>
        </form>
      </Card>
      <div className="space-y-3">
        {rows?.map((row) => (
          <Link href={`/app/inventory/${row.id}`} key={row.id}>
            <Card className="grid gap-3 sm:grid-cols-4">
              <div className="sm:col-span-2">
                <h2 className="font-bold">
                  {row.product_name} · {row.variant_name}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Item Code {row.sku} · {row.category_name} · {row.branch_name}
                </p>
              </div>
              <div>
                <strong>
                  {formatQuantity(row.quantity_on_hand, row.unit_symbol)}
                </strong>
                <p className="text-xs text-muted-foreground">
                  Minimum{" "}
                  {formatQuantity(row.minimum_stock_level, row.unit_symbol)}
                </p>
              </div>
              <span className="font-semibold">
                {String(row.stock_status).replaceAll("_", " ")}
              </span>
            </Card>
          </Link>
        ))}
        {!rows?.length ? (
          <Card>No inventory has been initialized for the selected scope.</Card>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">
        Showing {rows?.length ?? 0} of {count ?? 0}.{" "}
        {page > 1 ? (
          <Link href={`?page=${page - 1}`} className="text-primary">
            Previous
          </Link>
        ) : null}{" "}
        {(count ?? 0) > page * size ? (
          <Link href={`?page=${page + 1}`} className="ml-3 text-primary">
            Next
          </Link>
        ) : null}
      </p>
    </div>
  );
}
