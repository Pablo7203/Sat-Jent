import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
import {
  acceptStoreOrderRequest,
  updateStoreOrderRequest,
} from "@/features/store-orders/actions";

type Item = {
  id: string;
  product_name_snapshot: string;
  variant_name_snapshot: string;
  sku_snapshot: string;
  unit_snapshot: string;
  quantity: number | string;
  estimated_unit_price: number | string | null;
};

export default async function StoreOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; updated?: string; sale?: string }>;
}) {
  const { id } = await params;
  const context = await requirePermission("store_orders.read");
  const db = await createClient();
  const { data } = await db
    .from("store_order_requests")
    .select(
      "id,request_number,branch_id,customer_name,customer_phone,customer_email,customer_company,customer_message,status,estimated_total,linked_sale_id,created_at,status_changed_at,branch:branches(name),items:store_order_request_items(id,product_name_snapshot,variant_name_snapshot,sku_snapshot,unit_snapshot,quantity,estimated_unit_price),sale:sales(sale_number)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const order = data as unknown as {
    id: string;
    request_number: string;
    branch_id: string;
    customer_name: string;
    customer_phone: string;
    customer_email: string | null;
    customer_company: string | null;
    customer_message: string | null;
    status: string;
    estimated_total: number | string | null;
    linked_sale_id: string | null;
    created_at: string;
    status_changed_at: string | null;
    branch: { name: string } | { name: string }[] | null;
    items: Item[];
    sale: { sale_number: string } | { sale_number: string }[] | null;
  };
  const paramsValue = await searchParams;
  const branch = Array.isArray(order.branch) ? order.branch[0] : order.branch;
  const sale = Array.isArray(order.sale) ? order.sale[0] : order.sale;
  const canUpdate = context.permissions.includes("store_orders.update");
  const canConfirm = context.permissions.includes("store_orders.confirm");
  const canAct = ["PENDING_CONFIRMATION", "CONTACTED"].includes(order.status);

  return (
    <div className="space-y-6">
      <PageHeader
        title={order.request_number}
        description={`${branch?.name ?? "Branch"} · received ${new Date(order.created_at).toLocaleString("en-GH")}`}
      />
      {paramsValue.updated ? (
        <p className="rounded-xl border border-success/30 bg-success/10 p-4 text-sm">
          The request status has been updated.
        </p>
      ) : null}
      {paramsValue.error ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm">
          The request could not be updated. Check your permissions, the current
          status and product prices, then try again.
        </p>
      ) : null}
      {paramsValue.sale && sale ? (
        <p className="rounded-xl border border-success/30 bg-success/10 p-4 text-sm">
          A staff sales draft has been created. Review its current prices and
          availability before completing the sale.
        </p>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <section className="rounded-2xl border bg-surface p-5 sm:p-7">
            <h2 className="font-semibold">Requested products</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-2">Product</th>
                    <th className="py-2">SKU</th>
                    <th className="py-2">Quantity</th>
                    <th className="py-2">Website estimate</th>
                  </tr>
                </thead>
                <tbody>
                  {(order.items ?? []).map((item) => (
                    <tr className="border-b" key={item.id}>
                      <td className="py-3 pr-4">
                        <span className="font-semibold">
                          {item.product_name_snapshot}
                        </span>
                        <span className="mt-1 block text-xs text-muted-foreground">
                          {item.variant_name_snapshot}
                        </span>
                      </td>
                      <td className="py-3 pr-4">{item.sku_snapshot}</td>
                      <td className="py-3 pr-4">
                        {item.quantity} {item.unit_snapshot}
                      </td>
                      <td className="py-3">
                        {item.estimated_unit_price == null
                          ? "Confirm price"
                          : `GHS ${Number(item.estimated_unit_price).toFixed(2)} / ${item.unit_snapshot}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-between border-t pt-4 text-sm">
              <span>Estimated total</span>
              <strong>
                {order.estimated_total == null
                  ? "Confirm with customer"
                  : `GHS ${Number(order.estimated_total).toFixed(2)}`}
              </strong>
            </div>
          </section>
          <section className="rounded-2xl border bg-surface p-5 sm:p-7">
            <h2 className="font-semibold">Customer details</h2>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted-foreground">Name</dt>
                <dd className="mt-1 font-medium">{order.customer_name}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Phone</dt>
                <dd className="mt-1 font-medium">
                  <a href={`tel:${order.customer_phone}`}>
                    {order.customer_phone}
                  </a>
                </dd>
              </div>
              {order.customer_email ? (
                <div>
                  <dt className="text-xs text-muted-foreground">Email</dt>
                  <dd className="mt-1 font-medium">
                    <a href={`mailto:${order.customer_email}`}>
                      {order.customer_email}
                    </a>
                  </dd>
                </div>
              ) : null}
              {order.customer_company ? (
                <div>
                  <dt className="text-xs text-muted-foreground">Company</dt>
                  <dd className="mt-1 font-medium">{order.customer_company}</dd>
                </div>
              ) : null}
            </dl>
            {order.customer_message ? (
              <div className="mt-5 border-t pt-4 text-sm">
                <p className="text-xs text-muted-foreground">Project notes</p>
                <p className="mt-2 whitespace-pre-wrap">
                  {order.customer_message}
                </p>
              </div>
            ) : null}
          </section>
        </div>
        <aside className="h-fit rounded-2xl border bg-surface p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Request status
          </p>
          <p className="mt-2 text-lg font-semibold">
            {order.status.replaceAll("_", " ")}
          </p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            The customer has not paid. Stock is not reserved until a sale is
            completed through the existing sales workflow.
          </p>
          {sale ? (
            <Link
              className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-white"
              href={`/app/sales/${order.linked_sale_id}`}
            >
              {order.status === "SALE_COMPLETED"
                ? "View completed sale"
                : "Review sales draft"}{" "}
              · {sale.sale_number}
            </Link>
          ) : null}
          {canAct && canConfirm && !sale ? (
            <form action={acceptStoreOrderRequest} className="mt-5">
              <input name="id" type="hidden" value={order.id} />
              <button className="min-h-11 w-full rounded-lg bg-primary px-4 text-sm font-semibold text-white">
                Create sales draft
              </button>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                Recalculates using current SAT-J branch prices. Staff must
                review and complete the sale to deduct stock.
              </p>
            </form>
          ) : null}
          {canAct && canUpdate ? (
            <div className="mt-5 grid gap-2 border-t pt-5">
              {order.status === "PENDING_CONFIRMATION" ? (
                <form action={updateStoreOrderRequest}>
                  <input name="id" type="hidden" value={order.id} />
                  <input name="status" type="hidden" value="CONTACTED" />
                  <button className="min-h-10 w-full rounded-lg border px-4 text-sm font-semibold">
                    Mark customer contacted
                  </button>
                </form>
              ) : null}
              <form action={updateStoreOrderRequest}>
                <input name="id" type="hidden" value={order.id} />
                <input name="status" type="hidden" value="DECLINED" />
                <button className="min-h-10 w-full rounded-lg border border-destructive/40 px-4 text-sm font-semibold text-destructive">
                  Decline request
                </button>
              </form>
            </div>
          ) : null}
          <Link
            className="mt-5 block text-center text-sm font-semibold text-primary"
            href="/app/store-orders"
          >
            Back to requests
          </Link>
        </aside>
      </div>
    </div>
  );
}
