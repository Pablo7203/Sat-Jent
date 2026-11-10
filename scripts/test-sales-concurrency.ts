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
  branch: "44000000-0000-4000-8000-000000000001",
  category: "51400000-0000-4000-8000-000000000001",
  unit: "53400000-0000-4000-8000-000000000001",
  product: "56400000-0000-4000-8000-000000000001",
  variant: "57400000-0000-4000-8000-000000000001",
  customer: "94000000-0000-4000-8000-000000000001",
};
async function main() {
  const email = "sales-concurrency@test.invalid";
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  let user = listed.data.users.find((x) => x.email === email);
  if (!user) {
    const made = await admin.auth.admin.createUser({
      email,
      password: env.E2E_ACTIVE_PASSWORD,
      email_confirm: true,
    });
    if (made.error || !made.data.user) throw made.error;
    user = made.data.user;
  }
  await admin.from("profiles").upsert({
    id: user.id,
    full_name: "Sales Concurrency Manager",
    role_id: "10000000-0000-4000-8000-000000000003",
    is_active: true,
  });
  await admin.from("branches").upsert({
    id: ids.branch,
    code: "SALCON",
    name: "Sales Concurrency",
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
    name: "Sales Concurrency",
    slug: "sales-concurrency",
  });
  await admin.from("units_of_measure").upsert({
    id: ids.unit,
    code: "SCC",
    name: "Sales concurrency pieces",
    symbol: "pc",
    allows_decimal: false,
  });
  await admin.from("products").upsert({
    id: ids.product,
    name: "Sales Concurrency Product",
    category_id: ids.category,
    unit_of_measure_id: ids.unit,
    status: "DRAFT",
  });
  await admin.from("product_variants").upsert({
    id: ids.variant,
    product_id: ids.product,
    name: "Standard",
    sku: "SALE-CONCURRENCY",
    is_default: true,
  });
  await admin
    .from("products")
    .update({ status: "ACTIVE" })
    .eq("id", ids.product);
  await admin.from("product_prices").upsert(
    {
      id: "94400000-0000-4000-8000-000000000001",
      variant_id: ids.variant,
      price_type: "RETAIL",
      amount: 10,
    },
    { onConflict: "id" },
  );
  await admin.from("customers").upsert(
    {
      id: ids.customer,
      customer_code: "CUS-CONC",
      customer_type: "INDIVIDUAL",
      name: "Concurrency Customer",
      is_active: true,
    },
    { onConflict: "id" },
  );
  const client = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false } },
  );
  const login = await client.auth.signInWithPassword({
    email,
    password: env.E2E_ACTIVE_PASSWORD,
  });
  if (login.error) throw login.error;
  const existing = await client
    .from("branch_inventory")
    .select("id")
    .eq("branch_id", ids.branch)
    .eq("variant_id", ids.variant)
    .maybeSingle();
  if (!existing.data) {
    const opening = await client.rpc("post_opening_stock_batch", {
      target_branch: ids.branch,
      items: [{ variant_id: ids.variant, quantity: 5 }],
      operation_notes: "Sale concurrency",
    });
    if (opening.error) throw opening.error;
  }
  const make = async (qty: number, note: string) =>
    client.rpc("create_sale", {
      target_branch: ids.branch,
      target_customer: ids.customer,
      due_on: null,
      sale_notes: note,
      sale_discount: 0,
      discount_reason: null,
      items: [
        {
          variant_id: ids.variant,
          quantity: qty,
          price_type: "RETAIL",
          discount_amount: 0,
        },
      ],
    });
  const [aDraft, bDraft] = await Promise.all([
    make(4, "Concurrent sale A"),
    make(3, "Concurrent sale B"),
  ]);
  if (aDraft.error || bDraft.error) throw aDraft.error ?? bDraft.error;
  const [a, b] = await Promise.all([
    client.rpc("complete_sale", {
      target_sale: aDraft.data,
      operation_id: crypto.randomUUID(),
      initial_payment: 0,
      method: null,
      payment_reference: null,
      payment_notes: null,
    }),
    client.rpc("complete_sale", {
      target_sale: bDraft.data,
      operation_id: crypto.randomUUID(),
      initial_payment: 0,
      method: null,
      payment_reference: null,
      payment_notes: null,
    }),
  ]);
  const successes = [a, b].filter((x) => !x.error).length;
  if (successes !== 1)
    throw new Error(
      `Expected one successful concurrent sale, got ${successes}.`,
    );
  const balance = await admin
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
    throw new Error("Concurrent sales produced invalid inventory.");
  const movements = await admin
    .from("stock_movements")
    .select("quantity_delta")
    .eq("branch_id", ids.branch)
    .eq("variant_id", ids.variant);
  const sum = (movements.data ?? []).reduce(
    (n, x) => n + Number(x.quantity_delta),
    0,
  );
  if (sum !== Number(balance.data.quantity_on_hand))
    throw new Error("Ledger/current balance mismatch after concurrent sales.");
  process.stdout.write(
    `Sales concurrency PASS: one sale completed; final balance ${balance.data.quantity_on_hand}.\n`,
  );
}
main().catch((e: unknown) => {
  process.stderr.write(
    `${e instanceof Error ? e.message : "Sales concurrency failed."}\n`,
  );
  process.exitCode = 1;
});
