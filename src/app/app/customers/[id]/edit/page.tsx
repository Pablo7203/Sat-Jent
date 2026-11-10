import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { CustomerForm } from "@/features/sales/forms";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("customers.update");
  const { id } = await params,
    s = await createClient(),
    { data } = await s.from("customers").select("*").eq("id", id).maybeSingle();
  if (!data || data.is_walk_in) notFound();
  return (
    <div className="space-y-6">
      <PageHeader
        backHref={`/app/customers/${id}`}
        title={`Edit ${data.name}`}
      />
      <Card>
        <CustomerForm customer={data} />
      </Card>
    </div>
  );
}
