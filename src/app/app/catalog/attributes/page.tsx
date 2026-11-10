import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createAttributeValue,
  mapCategoryAttribute,
  toggleReference,
} from "@/features/catalog/actions";
import { ReferenceForm } from "@/features/catalog/forms";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

export default async function AttributesPage() {
  const context = await requirePermission("product_attributes.read");
  const s = await createClient();
  const [{ data: attributes }, { data: categories }] = await Promise.all([
    s
      .from("attributes")
      .select(
        "id,name,code,data_type,is_active,attribute_values(id,value,is_active),category_attributes(category_id,is_required,category:categories(name))",
      )
      .order("name"),
    s.from("categories").select("id,name").eq("is_active", true).order("name"),
  ]);
  const can = context.permissions.includes("product_attributes.manage");
  return (
    <div className="space-y-6">
      <PageHeader
        title="Product attributes"
        description="Typed variant characteristics are explicitly mapped to relevant categories."
      />
      <nav className="flex flex-wrap gap-3 text-sm">
        <Link className="text-primary" href="/app/catalog/categories">
          Categories
        </Link>
        <Link className="text-primary" href="/app/catalog/brands">
          Brands
        </Link>
        <Link className="text-primary" href="/app/catalog/units">
          Units
        </Link>
        <Link className="text-primary" href="/app/catalog/pricing">
          Pricing
        </Link>
      </nav>
      {can ? (
        <Card>
          <h2 className="mb-4 font-bold">Create attribute</h2>
          <ReferenceForm kind="attribute" />
        </Card>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {attributes?.map((a) => (
          <Card key={a.id}>
            <div className="flex justify-between">
              <div>
                <h2 className="font-bold">{a.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {a.code} · {a.data_type}
                </p>
              </div>
              <span className="text-xs">
                {a.is_active ? "Active" : "Inactive"}
              </span>
            </div>
            {a.attribute_values?.length ? (
              <p className="mt-3 text-sm">
                <strong>Allowed values:</strong>{" "}
                {a.attribute_values.map((v) => v.value).join(", ")}
              </p>
            ) : null}
            {a.category_attributes?.length ? (
              <p className="mt-2 text-sm">
                <strong>Categories:</strong>{" "}
                {a.category_attributes
                  .map(
                    (m) =>
                      `${m.category[0]?.name ?? "Category"}${m.is_required ? " (required)" : ""}`,
                  )
                  .join(", ")}
              </p>
            ) : null}
            {can ? (
              <div className="mt-4 space-y-3">
                {a.data_type === "SELECT" ? (
                  <form action={createAttributeValue} className="flex gap-2">
                    <input type="hidden" name="attributeId" value={a.id} />
                    <Label className="flex-1">
                      New allowed value
                      <Input name="value" required />
                    </Label>
                    <Button className="self-end">Add</Button>
                  </form>
                ) : null}
                <form
                  action={mapCategoryAttribute}
                  className="grid gap-2 sm:grid-cols-2"
                >
                  <input type="hidden" name="attributeId" value={a.id} />
                  <Label>
                    Assign category
                    <select
                      name="categoryId"
                      className="mt-1 min-h-11 w-full rounded-lg border bg-surface px-3"
                    >
                      {categories?.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </Label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name="isRequired" /> Required
                  </label>
                  <Button>Assign / update</Button>
                </form>
                <form action={toggleReference}>
                  <input type="hidden" name="table" value="attributes" />
                  <input type="hidden" name="id" value={a.id} />
                  <input
                    type="hidden"
                    name="active"
                    value={String(!a.is_active)}
                  />
                  <Button variant="secondary">
                    {a.is_active ? "Deactivate" : "Activate"}
                  </Button>
                </form>
              </div>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
