import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";
import type { ProductLookupResult } from "@/features/inventory/product-lookup";

export async function GET(request: Request) {
  const context = await requirePermission("inventory.read");
  const params = new URL(request.url).searchParams;
  const query = (params.get("q") ?? "").trim().slice(0, 100);
  const branchId = params.get("branchId") || null;

  if (branchId) {
    const branch = context.accessibleBranches.find(
      (item) => item.id === branchId && item.isActive,
    );
    if (!branch)
      return NextResponse.json(
        { error: "Branch access denied." },
        { status: 403 },
      );
  }
  if (!query)
    return NextResponse.json(
      { results: [] },
      { headers: { "Cache-Control": "private, no-store" } },
    );

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_inventory_products", {
    search_text: query,
    selected_branch_id: branchId,
    result_limit: 12,
  });
  if (error) {
    return NextResponse.json(
      {
        error: error.message.includes("permission")
          ? "Inventory access is required."
          : "Product search is temporarily unavailable.",
      },
      { status: error.message.includes("permission") ? 403 : 500 },
    );
  }

  const results = (data ?? []) as Omit<ProductLookupResult, "allows_decimal">[];
  const variantIds = results.map((result) => result.variant_id);
  const { data: units, error: unitsError } = variantIds.length
    ? await supabase
        .from("product_variants")
        .select(
          "id,product:products!inner(unit:units_of_measure!inner(allows_decimal),product_type:product_types(name))",
        )
        .in("id", variantIds)
    : { data: [], error: null };
  if (unitsError) {
    return NextResponse.json(
      { error: "Product search is temporarily unavailable." },
      { status: 500 },
    );
  }
  const decimalByVariant = new Map(
    ((units ?? []) as { id: string; product: unknown }[]).map((row) => {
      const product = row.product as unknown as {
        unit: { allows_decimal: boolean };
        product_type: { name: string } | { name: string }[] | null;
      };
      const productType = Array.isArray(product.product_type)
        ? product.product_type[0]
        : product.product_type;
      return [
        row.id,
        {
          allowsDecimal: product.unit.allows_decimal,
          productTypeName: productType?.name ?? null,
        },
      ] as const;
    }),
  );
  const now = new Date().toISOString();
  const { data: wholesalePrices, error: priceError } = variantIds.length
    ? await supabase
        .from("product_prices")
        .select("variant_id,branch_id,amount,effective_from,effective_to")
        .in("variant_id", variantIds)
        .eq("price_type", "WHOLESALE")
        .lte("effective_from", now)
        .or(`effective_to.is.null,effective_to.gt.${now}`)
    : { data: [], error: null };
  if (priceError) {
    return NextResponse.json(
      { error: "Product search is temporarily unavailable." },
      { status: 500 },
    );
  }
  const wholesaleByVariant = new Map<
    string,
    { amount: number | string; branchSpecific: boolean }
  >();
  for (const price of wholesalePrices ?? []) {
    if (price.branch_id && price.branch_id !== branchId) continue;
    const previous = wholesaleByVariant.get(price.variant_id);
    const isBranchPrice = price.branch_id === branchId;
    if (previous === undefined || (isBranchPrice && !previous.branchSpecific)) {
      wholesaleByVariant.set(price.variant_id, {
        amount: price.amount,
        branchSpecific: isBranchPrice,
      });
    }
  }

  return NextResponse.json(
    {
      results: results.map((result) => ({
        ...result,
        allows_decimal:
          decimalByVariant.get(result.variant_id)?.allowsDecimal ?? true,
        product_type_name:
          decimalByVariant.get(result.variant_id)?.productTypeName ?? null,
        wholesale_selling_price:
          wholesaleByVariant.get(result.variant_id)?.amount ?? null,
      })),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
