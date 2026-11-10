import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { PaymentForm } from "@/features/purchasing/forms";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requirePermission("supplier_payments.create");
  const { id } = await params,
    s = await createClient(),
    { data: p } = await s
      .from("purchase_statement")
      .select("purchase_number,supplier_id,branch_id,balance_due,status")
      .eq("id", id)
      .maybeSingle();
  if (!p || p.status === "CANCELLED" || Number(p.balance_due) <= 0) notFound();
  const { data: accountRows } = await s
    .from("financial_accounts")
    .select(
      "id,code,name,account_type,financial_account_branches!inner(branch_id)",
    )
    .eq("financial_account_branches.branch_id", p.branch_id)
    .eq("is_active", true)
    .order("name");
  const accounts = (accountRows ?? []).map((account) => ({
    id: account.id,
    label: `${account.name} · ${account.account_type}`,
  }));
  return (
    <div className="space-y-6">
      <PageHeader
        title={`Pay ${p.purchase_number}`}
        description="The database prevents duplicate submission and payment above the outstanding balance."
      />
      <Card>
        <PaymentForm
          accounts={accounts}
          canBackdate={["SUPER_ADMIN", "OWNER"].includes(context.role.code)}
          purchase={{
            purchaseId: id,
            supplierId: p.supplier_id,
            branchId: p.branch_id,
            balance: String(p.balance_due),
          }}
        />
      </Card>
    </div>
  );
}
