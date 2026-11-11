import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

const requestStatuses = [
  "PENDING_CONFIRMATION",
  "CONTACTED",
  "DRAFT_CREATED",
  "SALE_COMPLETED",
  "DECLINED",
  "CANCELLED",
] as const;

const fulfillmentStatuses = [
  "AWAITING_PAYMENT",
  "CONFIRMED",
  "PREPARING",
  "READY_FOR_PICKUP",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
] as const;

const allStatuses = Array.from(
  new Set([...requestStatuses, ...fulfillmentStatuses]),
);

function displayStatus(status: string | null) {
  return (status ?? "—").replaceAll("_", " ");
}

export default async function StoreOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await requirePermission("store_orders.read");
  const params = await searchParams;
  const db = await createClient();
  let query = db
    .from("store_order_requests")
    .select(
      "id,request_number,order_kind,payment_method,payment_status,fulfillment_method,fulfillment_status,customer_name,customer_phone,status,estimated_total,created_at,branch:branches(name),items:store_order_request_items(product_name_snapshot,variant_name_snapshot,quantity,unit_snapshot)",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (
    requestStatuses.includes(params.status as (typeof requestStatuses)[number])
  ) {
    query = query.eq("status", params.status!);
  } else if (
    fulfillmentStatuses.includes(
      params.status as (typeof fulfillmentStatuses)[number],
    )
  ) {
    query = query.eq("fulfillment_status", params.status!);
  }

  if (params.q) {
    const term = params.q.trim().replace(/[(),]/g, " ").slice(0, 80);
    if (term) {
      query = query.or(
        "request_number.ilike.%" +
          term +
          "%,customer_name.ilike.%" +
          term +
          "%,customer_phone.ilike.%" +
          term +
          "%",
      );
    }
  }

  const { data } = await query;
  const rows = (data ?? []) as unknown as {
    id: string;
    request_number: string;
    order_kind: string;
    payment_method: string | null;
    payment_status: string;
    fulfillment_method: string | null;
    fulfillment_status: string | null;
    customer_name: string;
    customer_phone: string;
    status: string;
    estimated_total: number | string | null;
    created_at: string;
    branch: { name: string } | { name: string }[] | null;
    items: {
      product_name_snapshot: string;
      variant_name_snapshot: string;
      quantity: number | string;
      unit_snapshot: string;
    }[];
  }[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Online orders"
        description="Review customer requests and track paid or pay-on-delivery orders across your authorised branches."
      />
      <form className="grid gap-3 rounded-2xl border bg-surface p-4 sm:grid-cols-[2fr_1fr_auto]">
        <label className="text-sm font-bold">
          Search
          <input
            className="mt-1 min-h-11 w-full rounded-lg border px-3 font-normal"
            defaultValue={params.q}
            name="q"
            placeholder="Order, customer or phone"
          />
        </label>
        <label className="text-sm font-bold">
          Status
          <select
            className="mt-1 min-h-11 w-full rounded-lg border px-3 font-normal"
            defaultValue={params.status ?? ""}
            name="status"
          >
            <option value="">All statuses</option>
            {allStatuses.map((status) => (
              <option key={status} value={status}>
                {displayStatus(status)}
              </option>
            ))}
          </select>
        </label>
        <button className="min-h-11 self-end rounded-lg bg-primary px-5 font-bold text-white">
          Filter
        </button>
      </form>

      <div className="overflow-x-auto rounded-2xl border bg-surface">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b bg-secondary">
              <th className="p-3">Order</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Branch</th>
              <th className="p-3">Items</th>
              <th className="p-3">Total</th>
              <th className="p-3">Payment</th>
              <th className="p-3">Status</th>
              <th className="p-3">Received</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const branch = Array.isArray(row.branch)
                ? row.branch[0]
                : row.branch;
              const items = row.items ?? [];
              const status =
                row.order_kind === "CHECKOUT"
                  ? row.fulfillment_status
                  : row.status;
              const payment =
                row.order_kind === "CHECKOUT"
                  ? row.payment_status === "PAID"
                    ? "Paid"
                    : row.payment_method === "PAY_ON_DELIVERY"
                      ? "Due on delivery"
                      : "Awaiting payment"
                  : "Request";

              return (
                <tr className="border-b align-top" key={row.id}>
                  <td className="p-3">
                    <Link
                      className="font-bold text-primary"
                      href={"/app/store-orders/" + row.id}
                    >
                      {row.request_number}
                    </Link>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {row.order_kind === "CHECKOUT"
                        ? row.fulfillment_method === "DELIVERY"
                          ? "Delivery"
                          : "Pickup"
                        : "Enquiry"}
                    </span>
                  </td>
                  <td className="p-3">
                    {row.customer_name}
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {row.customer_phone}
                    </span>
                  </td>
                  <td className="p-3">{branch?.name ?? "—"}</td>
                  <td className="min-w-48 p-3">
                    {items
                      .map(
                        (item) =>
                          item.product_name_snapshot +
                          " · " +
                          item.quantity +
                          " " +
                          item.unit_snapshot,
                      )
                      .join(", ") || "—"}
                  </td>
                  <td className="whitespace-nowrap p-3">
                    {row.estimated_total == null
                      ? "Confirm with customer"
                      : "GHS " + Number(row.estimated_total).toFixed(2)}
                  </td>
                  <td className="p-3">{payment}</td>
                  <td className="p-3">{displayStatus(status)}</td>
                  <td className="whitespace-nowrap p-3">
                    {new Date(row.created_at).toLocaleDateString("en-GH")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length ? (
          <p className="p-8 text-center text-muted-foreground">
            No online orders match these filters.
          </p>
        ) : null}
      </div>
    </div>
  );
}
