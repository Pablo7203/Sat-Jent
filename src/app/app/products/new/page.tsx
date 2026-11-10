import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { ProductForm } from "@/features/catalog/forms";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
export default async function NewProductPage() {
  await requirePermission("products.create");
  const s = await createClient();
  const [
    { data: categories },
    { data: productTypes },
    { data: brands },
    { data: units },
  ] = await Promise.all([
    s.from("categories").select("id,name").eq("is_active", true).order("name"),
    s
      .from("product_types")
      .select("id,category_id,name,is_active")
      .eq("is_active", true)
      .order("name"),
    s.from("brands").select("id,name").eq("is_active", true).order("name"),
    s
      .from("units_of_measure")
      .select("id,name,code")
      .eq("is_active", true)
      .order("name"),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/app/products"
        title="New product"
        description="Create the product and its required default sellable variant atomically."
      />
      <Card>
        {categories?.length && units?.length ? (
          <ProductForm
            categories={categories}
            productTypes={productTypes ?? []}
            brands={brands ?? []}
            units={units}
          />
        ) : (
          <p>
            Create an active category and unit of measure before adding
            products.
          </p>
        )}
      </Card>
    </div>
  );
}
