import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const rowSchema = z.object({
  branch_code: z.string().trim().min(1),
  variant_sku: z.string().trim().min(1),
  quantity: z.coerce.number().positive(),
  minimum_stock_level: z.coerce.number().nonnegative(),
  notes: z.string().trim().max(500),
});
function parseCsv(source: string): Record<string, string>[] {
  const records: string[][] = [];
  let record: string[] = [],
    field = "",
    quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (character === "," && !quoted) {
      record.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      record.push(field);
      field = "";
      if (record.some((value) => value.length)) records.push(record);
      record = [];
    } else field += character;
  }
  if (field.length || record.length) {
    record.push(field);
    records.push(record);
  }
  const [headers, ...rows] = records;
  if (!headers) return [];
  return rows.map((values) =>
    Object.fromEntries(
      headers.map((header, index) => [header.trim(), values[index] ?? ""]),
    ),
  );
}

async function main() {
  const apply = process.argv.includes("--apply");
  const file = process.argv.find((argument) => argument.endsWith(".csv"));
  if (!file) throw new Error("Provide the opening-stock CSV path.");
  const env = z
    .object({
      NEXT_PUBLIC_SUPABASE_URL: z.url(),
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
      OPENING_STOCK_OPERATOR_EMAIL: z.email(),
      OPENING_STOCK_OPERATOR_PASSWORD: z.string().min(12),
    })
    .parse(process.env);
  const rows = z
    .array(rowSchema)
    .min(1)
    .parse(parseCsv(await readFile(file, "utf8")));
  const duplicateKeys = rows.map(
    (row) =>
      `${row.branch_code.toUpperCase()}|${row.variant_sku.toUpperCase()}`,
  );
  if (new Set(duplicateKeys).size !== duplicateKeys.length)
    throw new Error("CSV contains a duplicate branch/SKU row.");

  const client = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false } },
  );
  const { error: signInError } = await client.auth.signInWithPassword({
    email: env.OPENING_STOCK_OPERATOR_EMAIL,
    password: env.OPENING_STOCK_OPERATOR_PASSWORD,
  });
  if (signInError)
    throw new Error("Opening-stock operator authentication failed.");
  const { data: branches, error: branchError } = await client
    .from("branches")
    .select("id,code")
    .in("code", [...new Set(rows.map((row) => row.branch_code))]);
  const { data: variants, error: variantError } = await client
    .from("product_variants")
    .select(
      "id,sku,products!inner(status,units_of_measure!inner(allows_decimal))",
    )
    .in("sku", [...new Set(rows.map((row) => row.variant_sku))]);
  if (branchError || variantError)
    throw new Error(
      "Could not resolve branches and variants with the operator account.",
    );
  const branchByCode = new Map(
    (branches ?? []).map((branch) => [branch.code.toUpperCase(), branch.id]),
  );
  const variantBySku = new Map(
    (variants ?? []).map((variant) => [variant.sku.toUpperCase(), variant]),
  );
  const validated = rows.map((row) => {
    const branchId = branchByCode.get(row.branch_code.toUpperCase());
    const variant = variantBySku.get(row.variant_sku.toUpperCase());
    if (!branchId)
      throw new Error(`Unknown or inaccessible branch: ${row.branch_code}`);
    if (!variant)
      throw new Error(`Unknown or inaccessible SKU: ${row.variant_sku}`);
    const product = Array.isArray(variant.products)
      ? variant.products[0]
      : variant.products;
    const unit =
      product &&
      (Array.isArray(product.units_of_measure)
        ? product.units_of_measure[0]
        : product.units_of_measure);
    if (!product || product.status !== "ACTIVE")
      throw new Error(`SKU is not active: ${row.variant_sku}`);
    if (!unit?.allows_decimal && !Number.isInteger(row.quantity))
      throw new Error(
        `SKU requires a whole-number quantity: ${row.variant_sku}`,
      );
    return { ...row, branchId, variantId: variant.id };
  });
  const { data: existing, error: existingError } = await client
    .from("branch_inventory")
    .select("branch_id,variant_id")
    .in("branch_id", [...new Set(validated.map((row) => row.branchId))]);
  if (existingError)
    throw new Error("Could not verify existing opening balances.");
  const existingKeys = new Set(
    (existing ?? []).map((item) => `${item.branch_id}|${item.variant_id}`),
  );
  const conflict = validated.find((row) =>
    existingKeys.has(`${row.branchId}|${row.variantId}`),
  );
  if (conflict)
    throw new Error(
      `Opening inventory already exists for ${conflict.branch_code}/${conflict.variant_sku}.`,
    );

  const grouped = Map.groupBy(validated, (row) => row.branchId);
  if (apply) {
    for (const [branchId, items] of grouped) {
      const { error } = await client.rpc("post_opening_stock_batch", {
        target_branch: branchId,
        items: items.map((row) => ({
          variant_id: row.variantId,
          quantity: row.quantity,
          minimum_stock_level: row.minimum_stock_level,
        })),
        operation_notes: `Controlled import: ${file}`,
      });
      if (error)
        throw new Error(
          `Opening-stock apply failed for branch ${items[0].branch_code}. No later branches were attempted.`,
        );
    }
  }
  process.stdout.write(
    `${JSON.stringify({ mode: apply ? "apply" : "dry-run", rows: validated.length, branches: grouped.size, total_quantity: validated.reduce((sum, row) => sum + row.quantity, 0) }, null, 2)}\n`,
  );
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Opening-stock import failed."}\n`,
  );
  process.exitCode = 1;
});
