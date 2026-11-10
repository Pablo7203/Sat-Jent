import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import {
  createExpense,
  decideExpense,
  payExpense,
} from "@/features/finance/actions";
import { requirePermission } from "@/lib/auth/authorization";
import { formatGhs } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type Expense = {
  id: string;
  expense_number: string;
  branch_id: string;
  category_id: string;
  description: string;
  expense_date: string;
  amount: number;
  amount_paid: number;
  status: string;
  payee: string | null;
  notes: string | null;
};
type Account = {
  id: string;
  name: string;
  account_type: string;
  branches: { branch_id: string }[];
};
const input =
  "mt-1 min-h-10 w-full rounded-lg border border-border bg-background px-3";
const today = new Date().toISOString().slice(0, 10);

export default async function ExpensesPage() {
  const context = await requirePermission("expenses.read");
  const db = await createClient();
  const [expenseResult, categoryResult, accountResult] = await Promise.all([
    db
      .from("expenses")
      .select("*")
      .order("expense_date", { ascending: false })
      .limit(200),
    db
      .from("expense_categories")
      .select("id,code,name,requires_approval")
      .eq("is_active", true)
      .order("name"),
    context.permissions.includes("finance.accounts.read")
      ? db
          .from("financial_accounts")
          .select("id,name,account_type,financial_account_branches(branch_id)")
          .eq("is_active", true)
          .order("name")
      : Promise.resolve({ data: [] }),
  ]);
  const expenses = (expenseResult.data ?? []) as unknown as Expense[];
  const categories = (categoryResult.data ?? []) as unknown as {
    id: string;
    code: string;
    name: string;
  }[];
  const accounts = (accountResult.data ?? []) as unknown as Account[];
  const branchName = (id: string) =>
    context.accessibleBranches.find((branch) => branch.id === id)?.name ??
    "Branch";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Expenses"
        description="Record, approve and pay operating expenses. Approval does not reduce an account balance; payment posts the ledger movement."
      />
      {context.permissions.includes("expenses.create") ? (
        <Card>
          <h2 className="mb-4 text-lg font-semibold">Submit an expense</h2>
          <form
            action={createExpense}
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
          >
            <label className="text-sm">
              Branch
              <select className={input} name="branchId" required>
                {context.accessibleBranches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Category
              <select className={input} name="categoryId" required>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Expense date
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
              Amount (GHS)
              <input
                className={input}
                type="number"
                step="0.01"
                min="0.01"
                name="amount"
                required
              />
            </label>
            <label className="text-sm sm:col-span-2">
              Description
              <input
                className={input}
                name="description"
                minLength={3}
                maxLength={1000}
                required
                placeholder="e.g. delivery fuel"
              />
            </label>
            <label className="text-sm">
              Payee
              <input className={input} name="payee" maxLength={160} />
            </label>
            <label className="text-sm">
              Notes
              <input className={input} name="notes" maxLength={1000} />
            </label>
            <div className="sm:col-span-2 xl:col-span-4">
              <button className="min-h-10 rounded-lg bg-primary px-4 font-medium text-primary-foreground">
                Submit for approval
              </button>
            </div>
          </form>
        </Card>
      ) : null}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Expense register</h2>
          <span className="text-sm text-muted-foreground">
            {expenses.length} recent records
          </span>
        </div>
        {!expenses.length ? (
          <p className="text-sm text-muted-foreground">
            No expenses recorded yet.
          </p>
        ) : (
          <div className="space-y-3">
            {expenses.map((expense) => {
              const remaining =
                Number(expense.amount) - Number(expense.amount_paid);
              const assigned = accounts.filter((account) =>
                account.branches.some(
                  (branch) => branch.branch_id === expense.branch_id,
                ),
              );
              return (
                <article
                  className="rounded-lg border border-border p-4"
                  key={expense.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        {expense.expense_number} · {expense.description}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {branchName(expense.branch_id)} ·{" "}
                        {categories.find(
                          (category) => category.id === expense.category_id,
                        )?.name ?? "Category"}{" "}
                        · {expense.expense_date}
                        {expense.payee ? ` · ${expense.payee}` : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {formatGhs(expense.amount)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {expense.status} · paid {formatGhs(expense.amount_paid)}
                      </p>
                    </div>
                  </div>
                  {expense.notes ? (
                    <p className="mt-2 text-sm text-muted-foreground">
                      {expense.notes}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {expense.status === "PENDING_APPROVAL" &&
                    context.permissions.includes("expenses.approve") ? (
                      <>
                        <form action={decideExpense}>
                          <input
                            type="hidden"
                            name="expenseId"
                            value={expense.id}
                          />
                          <input
                            type="hidden"
                            name="decision"
                            value="approve"
                          />
                          <button className="min-h-9 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground">
                            Approve
                          </button>
                        </form>
                        <form action={decideExpense} className="flex gap-2">
                          <input
                            type="hidden"
                            name="expenseId"
                            value={expense.id}
                          />
                          <input type="hidden" name="decision" value="reject" />
                          <input
                            className="min-h-9 rounded-lg border bg-background px-2 text-sm"
                            name="note"
                            required
                            minLength={3}
                            placeholder="Rejection reason"
                          />
                          <button className="min-h-9 rounded-lg border border-destructive/30 px-3 text-sm text-destructive">
                            Reject
                          </button>
                        </form>
                      </>
                    ) : null}
                    {["APPROVED", "PARTIALLY_PAID"].includes(expense.status) &&
                    context.permissions.includes("expenses.pay") ? (
                      <form
                        action={payExpense}
                        className="grid w-full gap-2 sm:grid-cols-2 xl:grid-cols-5"
                      >
                        <input
                          type="hidden"
                          name="expenseId"
                          value={expense.id}
                        />
                        <label className="text-xs">
                          Pay from
                          <select className={input} name="accountId" required>
                            {assigned.map((account) => (
                              <option key={account.id} value={account.id}>
                                {account.name} · {account.account_type}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="text-xs">
                          Amount remaining {formatGhs(remaining)}
                          <input
                            className={input}
                            name="amount"
                            type="number"
                            min="0.01"
                            max={remaining}
                            step="0.01"
                            defaultValue={remaining.toFixed(2)}
                            required
                          />
                        </label>
                        <label className="text-xs">
                          Payment date
                          <input
                            className={input}
                            name="date"
                            type="date"
                            max={today}
                            defaultValue={today}
                            required
                          />
                        </label>
                        <label className="text-xs">
                          Reference
                          <input className={input} name="reference" />
                        </label>
                        <button className="min-h-10 self-end rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">
                          Post payment
                        </button>
                      </form>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
