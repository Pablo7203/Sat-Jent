import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
import {
  acceptStoreOrderRequest,
  updateStoreOrderFulfillment,
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

type StatusEvent = {
  fulfillment_status: string;
  payment_status: string;
  created_at: string;
};

const fulfillmentLabels: Record<string, string> = {
  AWAITING_PAYMENT: "Awaiting payment",
  CONFIRMED: "Order confirmed",
  PREPARING: "Being prepared",
  READY_FOR_PICKUP: "Ready for collection",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

function nextStatuses(status: string, method: string | null): string[] {
  if (status === "CONFIRMED") return ["PREPARING", "CANCELLED"];
  if (status === "PREPARING") {
    return method === "DELIVERY"
      ? ["OUT_FOR_DELIVERY", "CANCELLED"]
      : ["READY_FOR_PICKUP", "CANCELLED"];
  }
  if (status === "READY_FOR_PICKUP" || status === "OUT_FOR_DELIVERY") {
    return ["DELIVERED"];
  }
  return [];
}

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
      "id,request_number,order_kind,branch_id,customer_name,customer_phone,customer_email,customer_company,customer_message,status,estimated_total,linked_sale_id,created_at,status_changed_at,fulfillment_method,payment_method,payment_status,fulfillment_status,delivery_address,delivery_instructions,branch:branches(name),items:store_order_request_items(id,product_name_snapshot,variant_name_snapshot,sku_snapshot,unit_snapshot,quantity,estimated_unit_price),sale:sales(sale_number)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();

  const order = data as unknown as {
    id: string;
    request_number: string;
    order_kind: string;
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
    fulfillment_method: string | null;
    payment_method: string | null;
    payment_status: string;
    fulfillment_status: string | null;
    delivery_address: string | null;
    delivery_instructions: string | null;
    branch: { name: string } | { name: string }[] | null;
    items: Item[];
    sale: { sale_number: string } | { sale_number: string }[] | null;
  };

  const [paramsValue, eventQuery] = await Promise.all([
    searchParams,
    order.order_kind === "CHECKOUT"
      ? db
          .from("store_order_status_events")
          .select("fulfillment_status,payment_status,created_at")
          .eq("order_id", order.id)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] as StatusEvent[] }),
  ]);

  const branch = Array.isArray(order.branch) ? order.branch[0] : order.branch;
  const sale = Array.isArray(order.sale) ? order.sale[0] : order.sale;
  const events = (eventQuery.data ?? []) as StatusEvent[];
  const isCheckout = order.order_kind === "CHECKOUT";
  const canUpdate = context.permissions.includes("store_orders.update");
  const canConfirm = context.permissions.includes("store_orders.confirm");
  const canAct = ["PENDING_CONFIRMATION", "CONTACTED"].includes(order.status);
  const allowedNext = nextStatuses(
    order.fulfillment_status ?? "",
    order.fulfillment_method,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={order.request_number}
        description={
          (branch?.name ?? "Branch") +
          " · received " +
          new Date(order.created_at).toLocaleString("en-GH")
        }
      />

      {paramsValue.updated ? (
        <p className="rounded-xl border border-success/30 bg-success/10 p-4 text-sm">
          The order update has been saved.
        </p>
      ) : null}
      {paramsValue.error ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm">
          The update could not be saved. Check payment, branch access and the
          current order status, then try again.
        </p>
      ) : null}
      {paramsValue.sale && sale ? (
        <p className="rounded-xl border border-success/30 bg-success/10 p-4 text-sm">
          A staff sales draft has been created. Review its current prices and
          availability before completing it.
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <section className="rounded-2xl border bg-surface p-5 sm:p-7">
            <h2 className="font-semibold">Ordered products</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-2">Product</th>
                    <th className="py-2">SKU</th>
                    <th className="py-2">Quantity</th>
                    <th className="py-2">Unit price</th>
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
                          : "GHS " +
                            Number(item.estimated_unit_price).toFixed(2) +
                            " / " +
                            item.unit_snapshot}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-between border-t pt-4 text-sm">
              <span>Total</span>
              <strong>
                {order.estimated_total == null
                  ? "Confirm with customer"
                  : "GHS " + Number(order.estimated_total).toFixed(2)}
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
                  <a href={"tel:" + order.customer_phone}>
                    {order.customer_phone}
                  </a>
                </dd>
              </div>
              {order.customer_email ? (
                <div>
                  <dt className="text-xs text-muted-foreground">Email</dt>
                  <dd className="mt-1 font-medium">
                    <a href={"mailto:" + order.customer_email}>
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
            {isCheckout && order.fulfillment_method === "DELIVERY" ? (
              <div className="mt-5 border-t pt-4 text-sm">
                <p className="text-xs text-muted-foreground">
                  Delivery address
                </p>
                <p className="mt-2 whitespace-pre-wrap">
                  {order.delivery_address}
                </p>
                {order.delivery_instructions ? (
                  <>
                    <p className="mt-4 text-xs text-muted-foreground">
                      Instructions
                    </p>
                    <p className="mt-2 whitespace-pre-wrap">
                      {order.delivery_instructions}
                    </p>
                  </>
                ) : null}
              </div>
            ) : null}
            {order.customer_message ? (
              <div className="mt-5 border-t pt-4 text-sm">
                <p className="text-xs text-muted-foreground">Project notes</p>
                <p className="mt-2 whitespace-pre-wrap">
                  {order.customer_message}
                </p>
              </div>
            ) : null}
          </section>

          {isCheckout ? (
            <section className="rounded-2xl border bg-surface p-5 sm:p-7">
              <h2 className="font-semibold">Order history</h2>
              <ol className="mt-4 space-y-4">
                {events.map((event, index) => (
                  <li className="flex gap-3 text-sm" key={index}>
                    <span
                      aria-hidden="true"
                      className="mt-1 size-2 shrink-0 rounded-full bg-primary"
                    />
                    <div>
                      <p className="font-medium">
                        {fulfillmentLabels[event.fulfillment_status] ??
                          event.fulfillment_status.replaceAll("_", " ")}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Payment: {event.payment_status}
                        {" · "}
                        {new Date(event.created_at).toLocaleString("en-GH")}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </div>

        <aside className="h-fit rounded-2xl border bg-surface p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {isCheckout ? "Fulfilment status" : "Request status"}
          </p>
          <p className="mt-2 text-lg font-semibold">
            {isCheckout
              ? (fulfillmentLabels[order.fulfillment_status ?? ""] ??
                order.fulfillment_status)
              : order.status.replaceAll("_", " ")}
          </p>

          {isCheckout ? (
            <>
              <div className="mt-4 rounded-xl bg-secondary p-4 text-sm">
                <p>
                  <span className="text-muted-foreground">
                    Payment method:{" "}
                  </span>
                  {order.payment_method === "PAYSTACK"
                    ? "Paystack"
                    : "Pay on delivery"}
                </p>
                <p className="mt-2">
                  <span className="text-muted-foreground">
                    Payment status:{" "}
                  </span>
                  {order.payment_status === "PAID" ? "Paid" : "Payment due"}
                </p>
                <p className="mt-2">
                  <span className="text-muted-foreground">Fulfilment: </span>
                  {order.fulfillment_method === "DELIVERY"
                    ? "Delivery"
                    : "Branch collection"}
                </p>
              </div>
              {canUpdate && allowedNext.length ? (
                <form
                  action={updateStoreOrderFulfillment}
                  className="mt-5 grid gap-3 border-t pt-5"
                >
                  <input name="id" type="hidden" value={order.id} />
                  <label className="text-sm font-semibold">
                    Move order to
                    <select
                      className="mt-2 min-h-11 w-full rounded-lg border bg-background px-3 text-sm font-normal"
                      defaultValue=""
                      name="status"
                      required
                    >
                      <option disabled value="">
                        Choose next status
                      </option>
                      {allowedNext.map((status) => (
                        <option key={status} value={status}>
                          {fulfillmentLabels[status] ?? status}
                        </option>
                      ))}
                    </select>
                  </label>
                  {order.payment_method === "PAY_ON_DELIVERY" ? (
                    <label className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
                      <input
                        className="mt-1"
                        name="cashCollected"
                        type="checkbox"
                        value="true"
                      />
                      Cash payment was received (required when marking
                      delivered)
                    </label>
                  ) : null}
                  <button className="min-h-11 rounded-lg bg-primary px-4 text-sm font-semibold text-white">
                    Save order update
                  </button>
                </form>
              ) : null}
            </>
          ) : (
            <>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                This customer enquiry does not reserve stock or take payment.
                Staff can review it and create a sales draft using current
                branch prices.
              </p>
              {sale ? (
                <Link
                  className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-white"
                  href={"/app/sales/" + order.linked_sale_id}
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
                    Staff must review and complete the sale to deduct stock.
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
            </>
          )}

          <Link
            className="mt-5 block text-center text-sm font-semibold text-primary"
            href="/app/store-orders"
          >
            Back to online orders
          </Link>
        </aside>
      </div>
    </div>
  );
}
