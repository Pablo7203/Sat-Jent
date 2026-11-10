import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { CustomerPaymentForm } from "@/features/sales/forms";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requirePermission("customer_payments.create");
  const { id } = await params,
    s = await createClient(),
    { data } = await s
      .from("sales_statement")
      .select("sale_number,customer_id,branch_id,balance_due,status,is_walk_in")
      .eq("id", id)
      .maybeSingle();
  if (
    !data ||
    data.status !== "COMPLETED" ||
    data.is_walk_in ||
    Number(data.balance_due) <= 0
  )
    notFound();
  const { data: accountRows } = await s
    .from("financial_accounts")
    .select(
      "id,code,name,account_type,financial_account_branches!inner(branch_id)",
    )
    .eq("financial_account_branches.branch_id", data.branch_id)
    .eq("is_active", true)
    .order("name");
  const accounts = (accountRows ?? []).map((account) => ({
    id: account.id,
    label: `${account.name} · ${account.account_type}`,
  }));
  return (
    <div className="space-y-6">
      <PageHeader
        title={`Payment for ${data.sale_number}`}
        description="Payments are immutable; corrections use controlled reversal."
      />
      <Card>
        <CustomerPaymentForm
          accounts={accounts}
          canBackdate={["SUPER_ADMIN", "OWNER"].includes(context.role.code)}
          sale={{
            saleId: id,
            customerId: data.customer_id,
            branchId: data.branch_id,
            balance: String(data.balance_due),
          }}
        />
      </Card>
    </div>
  );
}
