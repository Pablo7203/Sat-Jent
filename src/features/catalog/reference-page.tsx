import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toggleReference, updateCategory } from "./actions";
import { ProductTypeCreateForm, ProductTypeList, ReferenceForm } from "./forms";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
import type { PermissionCode } from "@/lib/auth/types";

const links = [
  ["Categories", "/app/catalog/categories"],
  ["Brands", "/app/catalog/brands"],
  ["Units", "/app/catalog/units"],
  ["Attributes", "/app/catalog/attributes"],
  ["Pricing", "/app/catalog/pricing"],
];
type ReferenceItem = {
  id: string;
  name: string;
  code?: string;
  slug?: string;
  data_type?: string;
  symbol?: string;
  is_active: boolean;
  parent_id?: string | null;
};
export async function ReferencePage({
  kind,
  title,
  table,
  read,
  manage,
}: {
  kind: "category" | "brand" | "unit" | "attribute";
  title: string;
  table: "categories" | "brands" | "units_of_measure" | "attributes";
  read: PermissionCode;
  manage: PermissionCode;
}) {
  const context = await requirePermission(read);
  const s = await createClient();
  const [{ data: items }, { data: categories }, { data: productTypes }] =
    await Promise.all([
      s.from(table).select("*").order("name"),
      s.from("categories").select("id,name,is_active").order("name"),
      kind === "category"
        ? s
            .from("product_types")
            .select("id,category_id,name,is_active")
            .order("name")
        : Promise.resolve({ data: [] }),
    ]);
  const can = context.permissions.includes(manage);
  const records = (items ?? []) as unknown as ReferenceItem[];
  const categoryNames = new Map(
    (categories ?? []).map((category) => [category.id, category.name]),
  );
  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description="Inactive records remain available to historical product records."
      />
      <nav className="flex flex-wrap gap-3 text-sm">
        {links.map(([l, h]) => (
          <Link className="text-primary hover:underline" href={h} key={h}>
            {l}
          </Link>
        ))}
      </nav>
      {can ? (
        <Card>
          <h2 className="mb-4 text-lg font-bold">Create {kind}</h2>
          <ReferenceForm
            kind={kind}
            categories={(categories ?? []).filter(
              (category) => category.is_active,
            )}
          />
        </Card>
      ) : null}
      {kind === "category" && can ? (
        <Card className="space-y-5">
          <div>
            <h2 className="text-lg font-bold">Optional product types</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Create types within a category, such as Floor tile under Tiles.
              Assigning a type to a product is optional. Existing products keep
              their category and attributes unchanged.
            </p>
          </div>
          <ProductTypeCreateForm
            categories={(categories ?? []).filter(
              (category) => category.is_active,
            )}
          />
          <ProductTypeList
            items={(productTypes ?? []).map((type) => ({
              ...type,
              category_name:
                categoryNames.get(type.category_id) ?? "Inactive category",
            }))}
          />
        </Card>
      ) : null}
      <div className="grid gap-3 lg:grid-cols-2">
        {records.map((item) => (
          <Card key={item.id}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-bold">{item.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {item.code ?? item.slug ?? item.data_type}
                  {item.symbol ? ` · ${item.symbol}` : ""}
                </p>
              </div>
              <span className="rounded-full bg-secondary px-3 py-1 text-xs">
                {item.is_active ? "Active" : "Inactive"}
              </span>
            </div>
            {can ? (
              <div className="mt-4 flex flex-wrap gap-3">
                <form action={toggleReference}>
                  <input type="hidden" name="table" value={table} />
                  <input type="hidden" name="id" value={item.id} />
                  <input
                    type="hidden"
                    name="active"
                    value={String(!item.is_active)}
                  />
                  <Button variant="secondary">
                    {item.is_active ? "Deactivate" : "Activate"}
                  </Button>
                </form>
                {kind === "category" ? (
                  <details className="w-full rounded-lg border bg-secondary/30 p-3">
                    <summary className="cursor-pointer text-sm font-semibold">
                      Edit category
                    </summary>
                    <form
                      action={updateCategory}
                      className="mt-4 grid gap-3 sm:grid-cols-2"
                    >
                      <input type="hidden" name="id" value={item.id} />
                      <label className="text-sm font-semibold">
                        Name
                        <input
                          className="mt-1 min-h-11 w-full rounded-lg border bg-surface px-3 font-normal"
                          defaultValue={item.name}
                          name="name"
                          required
                        />
                      </label>
                      <label className="text-sm font-semibold">
                        Slug
                        <input
                          className="mt-1 min-h-11 w-full rounded-lg border bg-surface px-3 font-normal"
                          defaultValue={item.slug}
                          name="slug"
                          required
                        />
                      </label>
                      <label className="text-sm font-semibold sm:col-span-2">
                        Parent
                        <select
                          className="mt-1 min-h-11 w-full rounded-lg border bg-surface px-3 font-normal"
                          defaultValue={item.parent_id ?? ""}
                          name="parentId"
                        >
                          <option value="">Top level</option>
                          {(categories ?? [])
                            .filter((category) => category.id !== item.id)
                            .map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                        </select>
                      </label>
                      <Button className="w-fit" type="submit">
                        Save category
                      </Button>
                    </form>
                  </details>
                ) : null}
              </div>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
