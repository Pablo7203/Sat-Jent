import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
const env = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    E2E_ACTIVE_PASSWORD: z.string().min(12),
  })
  .parse(process.env);
const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);
const ids = {
  branch: "42000000-0000-4000-8000-000000000001",
  category: "51200000-0000-4000-8000-000000000001",
  unit: "53200000-0000-4000-8000-000000000001",
  product: "56200000-0000-4000-8000-000000000001",
  variant: "57200000-0000-4000-8000-000000000001",
};
async function main() {
  const email = "inventory-concurrency@test.invalid";
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  let user = listed.data.users.find((x) => x.email === email);
  if (!user) {
    const created = await admin.auth.admin.createUser({
      email,
      password: env.E2E_ACTIVE_PASSWORD,
      email_confirm: true,
    });
    if (created.error || !created.data.user) throw created.error;
    user = created.data.user;
  }
  await admin.from("profiles").upsert({
    id: user.id,
    full_name: "Concurrency Inventory Officer",
    role_id: "10000000-0000-4000-8000-000000000005",
    is_active: true,
  });
  await admin.from("branches").upsert({
    id: ids.branch,
    code: "CONCUR",
    name: "Concurrency Branch",
    address: "Test",
    phone: "000",
  });
  await admin
    .from("user_branches")
    .upsert(
      { user_id: user.id, branch_id: ids.branch, is_active: true },
      { onConflict: "user_id,branch_id" },
    );
  await admin.from("categories").upsert({
    id: ids.category,
    name: "Concurrency Category",
    slug: "concurrency-category",
  });
  await admin.from("units_of_measure").upsert({
    id: ids.unit,
    code: "CPCS",
    name: "Concurrency Pieces",
    symbol: "pc",
    allows_decimal: false,
  });
  await admin.from("products").upsert({
    id: ids.product,
    name: "Concurrency Product",
    category_id: ids.category,
    unit_of_measure_id: ids.unit,
    status: "DRAFT",
  });
  await admin.from("product_variants").upsert({
    id: ids.variant,
    product_id: ids.product,
    name: "Standard",
    sku: "CONCURRENCY-SKU",
    is_default: true,
  });
  await admin
    .from("products")
    .update({ status: "ACTIVE" })
    .eq("id", ids.product);
  const client = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false } },
  );
  const signIn = await client.auth.signInWithPassword({
    email,
    password: env.E2E_ACTIVE_PASSWORD,
  });
  if (signIn.error) throw signIn.error;
  const existing = await client
    .from("branch_inventory")
    .select("id")
    .eq("branch_id", ids.branch)
    .eq("variant_id", ids.variant)
    .maybeSingle();
  if (!existing.data) {
    const opening = await client.rpc("post_opening_stock_batch", {
      target_branch: ids.branch,
      items: [{ variant_id: ids.variant, quantity: 5, minimum_stock_level: 0 }],
      operation_notes: "Concurrency test",
    });
    if (opening.error) throw opening.error;
  }
  const reason = "70000000-0000-4000-8000-000000000005";
  const first = await client.rpc("create_stock_adjustment", {
    target_branch: ids.branch,
    target_reason: reason,
    target_notes: "Concurrent A",
    items: [{ variant_id: ids.variant, quantity: 4, direction: "DECREASE" }],
  });
  const second = await client.rpc("create_stock_adjustment", {
    target_branch: ids.branch,
    target_reason: reason,
    target_notes: "Concurrent B",
    items: [{ variant_id: ids.variant, quantity: 3, direction: "DECREASE" }],
  });
  if (first.error || second.error) throw first.error ?? second.error;
  const [a, b] = await Promise.all([
    client.rpc("complete_stock_adjustment", { target_adjustment: first.data }),
    client.rpc("complete_stock_adjustment", { target_adjustment: second.data }),
  ]);
  const successes = [a, b].filter((x) => !x.error).length;
  if (successes !== 1)
    throw new Error(`Expected one successful decrease, received ${successes}.`);
  const balance = await client
    .from("branch_inventory")
    .select("quantity_on_hand")
    .eq("branch_id", ids.branch)
    .eq("variant_id", ids.variant)
    .single();
  if (
    balance.error ||
    Number(balance.data.quantity_on_hand) < 0 ||
    ![1, 2].includes(Number(balance.data.quantity_on_hand))
  )
    throw new Error("Concurrent decreases produced an invalid balance.");
  const integrity = await client.rpc("inventory_integrity_issues");
  if (integrity.error || integrity.data.length)
    throw new Error("Ledger reconciliation failed after concurrency test.");
  process.stdout.write(
    `Concurrency PASS: one completion succeeded; final balance ${balance.data.quantity_on_hand}.\n`,
  );
}
main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Concurrency test failed."}\n`,
  );
  process.exitCode = 1;
});
