import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { SupplierForm } from "@/features/purchasing/forms";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("suppliers.update");
  const { id } = await params,
    s = await createClient(),
    { data } = await s.from("suppliers").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  return (
    <div className="space-y-6">
      <PageHeader
        backHref={`/app/suppliers/${id}`}
        title={`Edit ${data.name}`}
      />
      <Card>
        <SupplierForm supplier={data} />
      </Card>
    </div>
  );
}
