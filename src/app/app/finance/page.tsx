import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { requireActiveProfile } from "@/lib/auth/authorization";
import { formatGhs } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import {
  createFinancialAccount,
  postAccountOpening,
  reconcileAccount,
} from "@/features/finance/actions";

type Account = {
  account_id: string;
  code: string;
  name: string;
  account_type: string;
  branch_id: string;
  book_balance: number;
};
type Movement = {
  id: string;
  effective_date: string;
  movement_kind: string;
  direction: string;
  amount: number;
  memo: string | null;
  account_id: string;
  branch_id: string;
};
type Transit = {
  transfer_number: string;
  variant_id: string;
  dispatched_quantity: number;
  received_quantity: number;
  unit_cost: number | null;
  in_transit_value: number | null;
  cost_status: string;
};
const input =
  "mt-1 min-h-10 w-full rounded-lg border border-border bg-background px-3";
const today = new Date().toISOString().slice(0, 10);

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; branch?: string }>;
}) {
  const context = await requireActiveProfile();
  const canAccounts = context.permissions.includes("finance.accounts.read");
  const canManage = context.permissions.includes("finance.accounts.manage");
  const canLedger = context.permissions.includes("finance.ledger.read");
  const canReconcile = context.permissions.includes("finance.reconcile");
  const canPnL = context.permissions.includes("reports.profitability.read");
  const q = await searchParams;
  const dateFrom = q.from || `${today.slice(0, 4)}-01-01`;
  const dateTo = q.to || today;
  const branchId =
    q.branch && context.accessibleBranches.some((b) => b.id === q.branch)
      ? q.branch
      : context.accessibleBranches[0]?.id;
  const db = await createClient();
  const [
    accountResult,
    balanceResult,
    movementResult,
    transitResult,
    pnlResult,
  ] = await Promise.all([
    canAccounts
      ? db
          .from("financial_accounts")
          .select(
            "id,code,name,account_type,financial_account_branches!inner(branch_id)",
          )
          .eq("financial_account_branches.branch_id", branchId ?? "")
          .eq("is_active", true)
          .order("name")
      : Promise.resolve({ data: [] }),
    canAccounts
      ? db
          .from("financial_account_balances")
          .select("account_id,branch_id,book_balance")
      : Promise.resolve({ data: [] }),
    canLedger
      ? db
          .from("financial_movements")
          .select(
            "id,effective_date,movement_kind,direction,amount,memo,account_id,branch_id",
          )
          .order("effective_date", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [] }),
    context.permissions.includes("transfers.read")
      ? db
          .from("transfer_cost_in_transit")
          .select(
            "transfer_number,variant_id,dispatched_quantity,received_quantity,unit_cost,in_transit_value,cost_status",
          )
      : Promise.resolve({ data: [] }),
    canPnL && branchId
      ? db.rpc("reporting_profit_and_loss", {
          date_from: dateFrom,
          date_to: dateTo,
          target_branch: branchId,
        })
      : Promise.resolve({ data: null }),
  ]);
  const accountRows = (accountResult.data ?? []) as unknown as {
    id: string;
    code: string;
    name: string;
    account_type: string;
  }[];
  const balances = (balanceResult.data ?? []) as unknown as Account[];
  const movements = (movementResult.data ?? []) as unknown as Movement[];
  const transit = (transitResult.data ?? []) as unknown as Transit[];
  const pnl = (pnlResult.data ?? null) as unknown as Record<
    string,
    unknown
  > | null;
  const branchLabel =
    context.accessibleBranches.find((branch) => branch.id === branchId)?.name ??
    "Branch";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Finance & accounts"
        description="Branch cash accounts, immutable movements, reconciliations and cost-aware profitability."
      />
      {canPnL ? (
        <Card className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">
              Profit & loss · {branchLabel}
            </h2>
            <p className="text-sm text-muted-foreground">
              Profit excludes unknown cost claims: if any sales line is
              unvalued, gross and operating profit are shown as incomplete.
            </p>
          </div>
          <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]" method="get">
            <input
              className={input}
              aria-label="From date"
              type="date"
              name="from"
              value={dateFrom}
            />
            <input
              className={input}
              aria-label="To date"
              type="date"
              name="to"
              value={dateTo}
            />
            <input type="hidden" name="branch" value={branchId ?? ""} />
            <button className="min-h-10 rounded-lg bg-primary px-4 font-medium text-primary-foreground">
              Run report
            </button>
          </form>
          {pnl ? (
            <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {[
                ["Revenue", pnl.revenue],
                ["Known COGS", pnl.known_cogs],
                ["Gross profit", pnl.gross_profit],
                ["Approved expenses", pnl.approved_expenses],
                ["Operating profit", pnl.operating_profit],
              ].map(([label, value]) => (
                <div
                  className="rounded-lg border border-border p-4"
                  key={String(label)}
                >
                  <dt className="text-sm text-muted-foreground">
                    {String(label)}
                  </dt>
                  <dd className="mt-1 text-xl font-semibold">
                    {value === null ? "Incomplete" : formatGhs(Number(value))}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p>No report available for this branch.</p>
          )}
          {Number(pnl?.unvalued_sale_lines ?? 0) > 0 ? (
            <p role="status" className="text-sm text-amber-800">
              {String(pnl?.unvalued_sale_lines)} sale line(s) have unknown cost.
              Profit totals are intentionally withheld until their cost basis is
              supported.
            </p>
          ) : null}
        </Card>
      ) : null}

      {canAccounts || canManage ? (
        <Card className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Branch accounts</h2>
            <p className="text-sm text-muted-foreground">
              Account balances are derived from posted movements, not editable
              balance fields.
            </p>
          </div>
          {balances.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {balances
                .filter((balance) => balance.branch_id === branchId)
                .map((balance) => {
                  const acct = accountRows.find(
                    (row) => row.id === balance.account_id,
                  );
                  return (
                    <div
                      className="rounded-lg border border-border p-4"
                      key={`${balance.account_id}:${balance.branch_id}`}
                    >
                      <p className="text-sm text-muted-foreground">
                        {acct?.code} · {acct?.account_type}
                      </p>
                      <p className="font-semibold">{acct?.name}</p>
                      <p className="mt-2 text-2xl font-semibold">
                        {formatGhs(balance.book_balance)}
                      </p>
                    </div>
                  );
                })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No accounts configured for this branch yet.
            </p>
          )}
          {canManage ? (
            <form
              action={createFinancialAccount}
              className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2 xl:grid-cols-5"
            >
              <h3 className="sm:col-span-2 xl:col-span-5 font-semibold">
                Add financial account
              </h3>
              <label className="text-sm">
                Code
                <input
                  className={input}
                  name="code"
                  required
                  maxLength={20}
                  placeholder="MAIN-CASH"
                />
              </label>
              <label className="text-sm">
                Name
                <input
                  className={input}
                  name="name"
                  required
                  maxLength={100}
                  placeholder="Main branch cash"
                />
              </label>
              <label className="text-sm">
                Type
                <select className={input} name="type">
                  <option>CASH</option>
                  <option>MOBILE_MONEY</option>
                  <option>BANK</option>
                  <option>CARD_CLEARING</option>
                  <option>OTHER</option>
                </select>
              </label>
              <fieldset className="text-sm">
                <legend>Assigned branch</legend>
                {context.accessibleBranches.map((branch) => (
                  <label className="mt-2 flex gap-2" key={branch.id}>
                    <input
                      type="checkbox"
                      name="branchIds"
                      value={branch.id}
                      defaultChecked={branch.id === branchId}
                    />
                    {branch.name}
                  </label>
                ))}
              </fieldset>
              <button className="min-h-10 self-end rounded-lg bg-primary px-4 font-medium text-primary-foreground">
                Create account
              </button>
            </form>
          ) : null}
          {canManage && branchId && accountRows.length ? (
            <form
              action={postAccountOpening}
              className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2 xl:grid-cols-5"
            >
              <h3 className="sm:col-span-2 xl:col-span-5 font-semibold">
                Post opening balance once · {branchLabel}
              </h3>
              <label className="text-sm">
                Account
                <select className={input} name="accountId">
                  {accountRows.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} · {a.account_type}
                    </option>
                  ))}
                </select>
              </label>
              <input type="hidden" name="branchId" value={branchId} />
              <label className="text-sm">
                Opening balance
                <input
                  className={input}
                  type="number"
                  min="0"
                  step="0.01"
                  name="amount"
                  required
                />
              </label>
              <label className="text-sm">
                As of
                <input
                  className={input}
                  type="date"
                  name="date"
                  max={today}
                  defaultValue={today}
                  required
                />
              </label>
              <label className="text-sm">
                Source / note
                <input className={input} name="note" minLength={5} required />
              </label>
              <input type="hidden" name="operationId" value="" />
              <button className="min-h-10 rounded-lg bg-primary px-4 font-medium text-primary-foreground">
                Post opening
              </button>
            </form>
          ) : null}
          {canReconcile && branchId && accountRows.length ? (
            <form
              action={reconcileAccount}
              className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2 xl:grid-cols-5"
            >
              <h3 className="sm:col-span-2 xl:col-span-5 font-semibold">
                Reconcile statement · {branchLabel}
              </h3>
              <label className="text-sm">
                Account
                <select className={input} name="accountId">
                  {accountRows.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} · {a.account_type}
                    </option>
                  ))}
                </select>
              </label>
              <input type="hidden" name="branchId" value={branchId} />
              <label className="text-sm">
                Statement balance
                <input
                  className={input}
                  type="number"
                  step="0.01"
                  name="amount"
                  required
                />
              </label>
              <label className="text-sm">
                Statement date
                <input
                  className={input}
                  type="date"
                  name="date"
                  max={today}
                  defaultValue={today}
                  required
                />
              </label>
              <label className="text-sm">
                Variance explanation
                <input
                  className={input}
                  name="note"
                  minLength={5}
                  placeholder="Required only when balances differ"
                />
              </label>
              <button className="min-h-10 rounded-lg bg-primary px-4 font-medium text-primary-foreground">
                Reconcile
              </button>
            </form>
          ) : null}
        </Card>
      ) : null}

      {canLedger ? (
        <Card>
          <h2 className="mb-3 text-lg font-semibold">
            Latest account movements
          </h2>
          {movements.filter((movement) => movement.branch_id === branchId)
            .length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-2">Date</th>
                    <th>Account</th>
                    <th>Type</th>
                    <th>Memo</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {movements
                    .filter((movement) => movement.branch_id === branchId)
                    .map((movement) => (
                      <tr className="border-b last:border-0" key={movement.id}>
                        <td className="py-2">{movement.effective_date}</td>
                        <td>
                          {accountRows.find((a) => a.id === movement.account_id)
                            ?.name ?? "Account"}
                        </td>
                        <td>{movement.movement_kind}</td>
                        <td>{movement.memo ?? "—"}</td>
                        <td className="text-right">
                          {movement.direction === "IN" ? "+" : "−"}
                          {formatGhs(movement.amount)}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No posted ledger movements.
            </p>
          )}
        </Card>
      ) : null}

      {transit.length ? (
        <Card>
          <h2 className="mb-3 text-lg font-semibold">
            Stock in transit valuation
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2">Transfer</th>
                  <th>Variant</th>
                  <th>Dispatched</th>
                  <th>Received</th>
                  <th>Cost state</th>
                  <th className="text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {transit.map((row) => (
                  <tr
                    className="border-b"
                    key={`${row.transfer_number}:${row.variant_id}`}
                  >
                    <td className="py-2">{row.transfer_number}</td>
                    <td>{row.variant_id}</td>
                    <td>{row.dispatched_quantity}</td>
                    <td>{row.received_quantity}</td>
                    <td>
                      {row.cost_status === "MISSING"
                        ? "UNVALUED"
                        : row.cost_status}
                    </td>
                    <td className="text-right">
                      {row.in_transit_value === null
                        ? "Unvalued"
                        : formatGhs(row.in_transit_value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
