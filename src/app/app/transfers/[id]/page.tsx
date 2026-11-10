import { notFound } from "next/navigation";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PrintButton } from "@/components/shared/print-button";
import {
  approveTransfer,
  cancelTransfer,
  dispatchTransfer,
  receiveTransfer,
  requestTransfer,
} from "@/features/transfers/actions";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

const stamp = (value: string | null) =>
  value ? new Date(value).toLocaleString() : "—";
export default async function TransferDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; updated?: string }>;
}) {
  const context = await requirePermission("transfers.read");
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const client = await createClient();
  const [{ data: transfer }, { data: items }, { data: branches }] =
    await Promise.all([
      client.from("stock_transfers").select("*").eq("id", id).maybeSingle(),
      client
        .from("stock_transfer_items")
        .select("*")
        .eq("transfer_id", id)
        .order("sku_snapshot"),
      client.rpc("active_transfer_branches"),
    ]);
  if (!transfer) notFound();
  const header = transfer as unknown as {
    transfer_number: string;
    source_branch_id: string;
    destination_branch_id: string;
    status: string;
    requested_at: string | null;
    approved_at: string | null;
    dispatched_at: string | null;
    received_at: string | null;
    created_by: string;
    notes: string | null;
    cancellation_reason: string | null;
  };
  const branchRows = (branches ?? []) as { id: string; name: string }[];
  const names = new Map(branchRows.map((branch) => [branch.id, branch.name]));
  const sourceAccess =
    context.role.scope === "COMPANY" ||
    context.accessibleBranches.some(
      (branch) => branch.id === header.source_branch_id,
    );
  const destinationAccess =
    context.role.scope === "COMPANY" ||
    context.accessibleBranches.some(
      (branch) => branch.id === header.destination_branch_id,
    );
  return (
    <div className="space-y-6">
      {query.error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
        >
          {query.error.slice(0, 250)}
        </p>
      ) : query.updated ? (
        <p
          role="status"
          className="rounded-lg border border-border bg-secondary/50 p-3 text-sm"
        >
          Transfer action completed.
        </p>
      ) : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Stock transfer</p>
          <h1 className="text-3xl font-bold">{header.transfer_number}</h1>
          <p>
            {names.get(header.source_branch_id)} →{" "}
            {names.get(header.destination_branch_id)} ·{" "}
            <strong>{header.status}</strong>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PrintButton />
          {header.status === "DRAFT" &&
          sourceAccess &&
          context.permissions.includes("transfers.create") ? (
            <ButtonLink href={`/app/transfers/${id}/edit`} variant="secondary">
              Edit
            </ButtonLink>
          ) : null}
        </div>
      </div>
      <Card>
        <dl className="grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-muted-foreground">Requested</dt>
            <dd>{stamp(header.requested_at)}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Approved</dt>
            <dd>{stamp(header.approved_at)}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Dispatched</dt>
            <dd>{stamp(header.dispatched_at)}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Received</dt>
            <dd>{stamp(header.received_at)}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Created by</dt>
            <dd className="break-all">{header.created_by}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">Notes</dt>
            <dd>{header.notes || "—"}</dd>
          </div>
        </dl>
      </Card>
      <Card>
        <h2 className="mb-3 text-lg font-bold">Items</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr>
                <th>Item</th>
                <th>Requested</th>
                <th>Approved</th>
                <th>Dispatched</th>
                <th>Received</th>
                <th>In transit</th>
              </tr>
            </thead>
            <tbody>
              {items?.map((item) => (
                <tr className="border-t" key={item.id}>
                  <td className="py-3">
                    <strong>{item.sku_snapshot}</strong> ·{" "}
                    {item.product_name_snapshot} / {item.variant_name_snapshot}
                  </td>
                  <td>
                    {item.requested_quantity} {item.unit_snapshot}
                  </td>
                  <td>{item.approved_quantity ?? "—"}</td>
                  <td>{item.dispatched_quantity}</td>
                  <td>{item.received_quantity}</td>
                  <td>
                    {Number(item.dispatched_quantity) -
                      Number(item.received_quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {header.status === "DRAFT" &&
      sourceAccess &&
      context.permissions.includes("transfers.create") ? (
        <Card>
          <h2 className="font-bold">Submit request</h2>
          <p className="my-2 text-sm text-muted-foreground">
            Submitting locks the item request for source approval. Inventory
            remains unchanged.
          </p>
          <form action={requestTransfer}>
            <input type="hidden" name="id" value={id} />
            <Button>Submit request</Button>
          </form>
        </Card>
      ) : null}
      {header.status === "REQUESTED" &&
      sourceAccess &&
      context.permissions.includes("transfers.approve") ? (
        <Card>
          <h2 className="font-bold">Approve transfer</h2>
          <p className="my-2 text-sm text-muted-foreground">
            Approval authorizes the requested quantities but does not reserve or
            move stock.
          </p>
          <form action={approveTransfer}>
            <input type="hidden" name="id" value={id} />
            <Button>Approve requested quantities</Button>
          </form>
        </Card>
      ) : null}
      {header.status === "APPROVED" &&
      sourceAccess &&
      context.permissions.includes("transfers.dispatch") ? (
        <Card>
          <h2 className="font-bold">Confirm dispatch</h2>
          <p className="my-2">
            Source inventory will decrease immediately. Destination inventory
            will not increase until receipt is confirmed.
          </p>
          <form action={dispatchTransfer}>
            <input type="hidden" name="id" value={id} />
            <Button>Confirm full dispatch</Button>
          </form>
        </Card>
      ) : null}
      {header.status === "DISPATCHED" &&
      destinationAccess &&
      context.permissions.includes("transfers.receive") ? (
        <Card>
          <h2 className="font-bold">Confirm receipt</h2>
          <p className="my-2">
            Confirm that every dispatched quantity arrived. These quantities
            will be added to destination inventory.
          </p>
          <form action={receiveTransfer}>
            <input type="hidden" name="id" value={id} />
            <Button>Confirm full receipt</Button>
          </form>
        </Card>
      ) : null}
      {["DRAFT", "REQUESTED", "APPROVED"].includes(header.status) &&
      sourceAccess &&
      context.permissions.includes("transfers.cancel") ? (
        <Card>
          <h2 className="font-bold">Cancel transfer</h2>
          <form action={cancelTransfer} className="mt-2 flex flex-wrap gap-2">
            <input type="hidden" name="id" value={id} />
            <label className="min-w-64 flex-1 text-sm">
              Cancellation reason
              <input
                className="mt-1 min-h-11 w-full rounded-lg border bg-surface px-3"
                name="reason"
                minLength={3}
                required
              />
            </label>
            <Button className="self-end" variant="danger">
              Cancel transfer
            </Button>
          </form>
        </Card>
      ) : null}
      {header.status === "CANCELLED" ? (
        <Card>
          <strong>Cancellation reason:</strong> {header.cancellation_reason}
        </Card>
      ) : null}
    </div>
  );
}
