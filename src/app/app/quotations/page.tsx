import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
export default async function QuotationsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await requirePermission("quotations.read");
  const p = await searchParams,
    db = await createClient();
  let query = db
    .from("quotation_requests")
    .select(
      "id,request_number,name,phone,product_name_snapshot,quantity,status,source,created_at,branch:branches(name),items:quotation_request_items(product_name_snapshot,quantity)",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (p.status) query = query.eq("status", p.status);
  if (p.q)
    query = query.or(
      `request_number.ilike.%${p.q}%,name.ilike.%${p.q}%,phone.ilike.%${p.q}%,product_name_snapshot.ilike.%${p.q}%`,
    );
  const { data } = await query;
  const rows = data ?? [];
  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotation requests"
        description="Public product and project enquiries visible in your authorized branch scope."
      />
      <form className="grid gap-3 rounded-2xl border bg-surface p-4 sm:grid-cols-[2fr_1fr_auto]">
        <label className="text-sm font-bold">
          Search
          <input
            className="mt-1 min-h-11 w-full rounded-lg border px-3 font-normal"
            name="q"
            defaultValue={p.q}
          />
        </label>
        <label className="text-sm font-bold">
          Status
          <select
            className="mt-1 min-h-11 w-full rounded-lg border px-3 font-normal"
            name="status"
            defaultValue={p.status ?? ""}
          >
            <option value="">All statuses</option>
            {["NEW", "CONTACTED", "IN_PROGRESS", "CLOSED", "CANCELLED"].map(
              (s) => (
                <option key={s}>{s}</option>
              ),
            )}
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
              <th className="p-3">Request</th>
              <th className="p-3">Prospect</th>
              <th className="p-3">Product</th>
              <th className="p-3">Branch</th>
              <th className="p-3">Status</th>
              <th className="p-3">Received</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr className="border-b" key={r.id}>
                <td className="p-3">
                  <Link
                    className="font-bold text-primary"
                    href={`/app/quotations/${r.id}`}
                  >
                    {r.request_number}
                  </Link>
                </td>
                <td className="p-3">
                  {r.name}
                  <br />
                  <span className="text-muted-foreground">{r.phone}</span>
                </td>
                <td className="p-3">
                  {(
                    r.items as unknown as
                      | {
                          product_name_snapshot: string;
                          quantity: number | null;
                        }[]
                      | null
                  )?.length
                    ? (
                        r.items as unknown as {
                          product_name_snapshot: string;
                        }[]
                      )
                        .map((item) => item.product_name_snapshot)
                        .join(", ")
                    : (r.product_name_snapshot ?? "General enquiry")}
                </td>
                <td className="p-3">
                  {(r.branch as unknown as { name: string } | null)?.name ??
                    "No preference"}
                </td>
                <td className="p-3">{r.status.replaceAll("_", " ")}</td>
                <td className="p-3">
                  {new Date(r.created_at).toLocaleDateString("en-GH")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length ? (
          <p className="p-8 text-center text-muted-foreground">
            No quotation requests match these filters.
          </p>
        ) : null}
      </div>
    </div>
  );
}
