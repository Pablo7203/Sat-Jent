import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
import { changeQuotationStatus } from "@/features/quotations/internal-actions";
export default async function QuotationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("quotations.read");
  const { id } = await params,
    { data: q } = await (
      await createClient()
    )
      .from("quotation_requests")
      .select(
        "*,branch:branches(name),items:quotation_request_items(product_name_snapshot,quantity)",
      )
      .eq("id", id)
      .maybeSingle();
  if (!q) notFound();
  return (
    <div className="space-y-6">
      <PageHeader
        title={q.request_number}
        description={`${q.source.replaceAll("_", " ")} · ${q.status.replaceAll("_", " ")}`}
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border bg-surface p-6">
          <h2 className="text-lg font-bold">Prospect</h2>
          <dl className="mt-5 grid gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-semibold">{q.name}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Phone</dt>
              <dd>
                <a href={`tel:${q.phone}`}>{q.phone}</a>
              </dd>
            </div>
            {q.email ? (
              <div>
                <dt className="text-muted-foreground">Email</dt>
                <dd>
                  <a href={`mailto:${q.email}`}>{q.email}</a>
                </dd>
              </div>
            ) : null}
            {q.customer_company ? (
              <div>
                <dt className="text-muted-foreground">Company</dt>
                <dd>{q.customer_company}</dd>
              </div>
            ) : null}
          </dl>
        </section>
        <section className="rounded-2xl border bg-surface p-6">
          <h2 className="text-lg font-bold">Request</h2>
          <dl className="mt-5 grid gap-4 text-sm">
            {(
              q.items as unknown as
                | { product_name_snapshot: string; quantity: number | null }[]
                | null
            )?.length ? (
              <div>
                <dt className="text-muted-foreground">Products requested</dt>
                <dd className="mt-2 grid gap-2">
                  {(
                    q.items as unknown as {
                      product_name_snapshot: string;
                      quantity: number | null;
                    }[]
                  ).map((item) => (
                    <span key={item.product_name_snapshot}>
                      {item.product_name_snapshot}
                      {item.quantity ? ` - Quantity: ${item.quantity}` : ""}
                    </span>
                  ))}
                </dd>
              </div>
            ) : (
              <div>
                <dt className="text-muted-foreground">Product</dt>
                <dd>{q.product_name_snapshot ?? "General project request"}</dd>
              </div>
            )}
            <div>
              <dt className="text-muted-foreground">Preferred branch</dt>
              <dd>
                {(q.branch as unknown as { name: string } | null)?.name ??
                  "No preference"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Message</dt>
              <dd className="whitespace-pre-wrap">
                {q.message ?? "No additional message."}
              </dd>
            </div>
          </dl>
        </section>
      </div>
      <form
        action={changeQuotationStatus}
        className="flex flex-wrap items-end gap-3 rounded-2xl border bg-surface p-6"
      >
        <input type="hidden" name="id" value={id} />
        <label className="text-sm font-bold">
          Update status
          <select
            className="mt-1 min-h-11 rounded-lg border px-3"
            name="status"
            defaultValue={q.status}
          >
            {["NEW", "CONTACTED", "IN_PROGRESS", "CLOSED", "CANCELLED"].map(
              (s) => (
                <option key={s}>{s}</option>
              ),
            )}
          </select>
        </label>
        <button className="min-h-11 rounded-lg bg-primary px-5 font-bold text-white">
          Save status
        </button>
      </form>
    </div>
  );
}
