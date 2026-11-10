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
  source: "46000000-0000-4000-8000-000000000001",
  destination: "46000000-0000-4000-8000-000000000002",
  category: "51600000-0000-4000-8000-000000000001",
  unit: "53600000-0000-4000-8000-000000000001",
  productA: "56600000-0000-4000-8000-000000000001",
  productB: "56600000-0000-4000-8000-000000000002",
  variantA: "57600000-0000-4000-8000-000000000001",
  variantB: "57600000-0000-4000-8000-000000000002",
  customer: "96000000-0000-4000-8000-000000000001",
};
async function main() {
  const email = "transfer-concurrency@test.invalid";
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  let user = listed.data.users.find((candidate) => candidate.email === email);
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
    full_name: "Transfer Concurrency Manager",
    role_id: "10000000-0000-4000-8000-000000000003",
    is_active: true,
  });
  await admin.from("branches").upsert([
    {
      id: ids.source,
      code: "TC-SRC",
      name: "Transfer Concurrency Source",
      address: "Test",
      phone: "000",
    },
    {
      id: ids.destination,
      code: "TC-DST",
      name: "Transfer Concurrency Destination",
      address: "Test",
      phone: "000",
    },
  ]);
  await admin
    .from("user_branches")
    .upsert(
      { user_id: user.id, branch_id: ids.source, is_active: true },
      { onConflict: "user_id,branch_id" },
    );
  await admin.from("categories").upsert({
    id: ids.category,
    name: "Transfer Concurrency",
    slug: "transfer-concurrency",
  });
  await admin.from("units_of_measure").upsert({
    id: ids.unit,
    code: "TCC",
    name: "Transfer concurrency pieces",
    symbol: "pc",
    allows_decimal: false,
  });
  await admin.from("products").upsert([
    {
      id: ids.productA,
      name: "Transfer Race Product",
      category_id: ids.category,
      unit_of_measure_id: ids.unit,
      status: "DRAFT",
    },
    {
      id: ids.productB,
      name: "Sale Transfer Race Product",
      category_id: ids.category,
      unit_of_measure_id: ids.unit,
      status: "DRAFT",
    },
  ]);
  await admin.from("product_variants").upsert([
    {
      id: ids.variantA,
      product_id: ids.productA,
      name: "Standard",
      sku: "TRANSFER-RACE",
      is_default: true,
    },
    {
      id: ids.variantB,
      product_id: ids.productB,
      name: "Standard",
      sku: "SALE-TRANSFER-RACE",
      is_default: true,
    },
  ]);
  await admin
    .from("products")
    .update({ status: "ACTIVE" })
    .in("id", [ids.productA, ids.productB]);
  await admin.from("product_prices").upsert(
    {
      id: "96600000-0000-4000-8000-000000000001",
      variant_id: ids.variantB,
      price_type: "RETAIL",
      amount: 10,
    },
    { onConflict: "id" },
  );
  await admin.from("customers").upsert(
    {
      id: ids.customer,
      customer_code: "CUS-TR-CONC",
      customer_type: "INDIVIDUAL",
      name: "Transfer Race Customer",
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
  for (const variant of [ids.variantA, ids.variantB]) {
    const current = await admin
      .from("branch_inventory")
      .select("id")
      .eq("branch_id", ids.source)
      .eq("variant_id", variant)
      .maybeSingle();
    if (!current.data) {
      const opening = await client.rpc("post_opening_stock_batch", {
        target_branch: ids.source,
        items: [{ variant_id: variant, quantity: 10 }],
        operation_notes: "Transfer concurrency",
      });
      if (opening.error) throw opening.error;
    }
  }
  const transfer = async (variant: string, note: string, quantity: number) => {
    const made = await client.rpc("create_transfer", {
      target_source: ids.source,
      target_destination: ids.destination,
      transfer_notes: note,
      submit_now: true,
      items: [{ variant_id: variant, quantity }],
    });
    if (made.error) throw made.error;
    const approved = await client.rpc("approve_transfer", {
      target_transfer: made.data,
    });
    if (approved.error) throw approved.error;
    return made.data as string;
  };
  const [first, second] = await Promise.all([
    transfer(ids.variantA, "Transfer race A", 6),
    transfer(ids.variantA, "Transfer race B", 6),
  ]);
  const transferRace = await Promise.all([
    client.rpc("dispatch_transfer", {
      target_transfer: first,
      operation_id: crypto.randomUUID(),
    }),
    client.rpc("dispatch_transfer", {
      target_transfer: second,
      operation_id: crypto.randomUUID(),
    }),
  ]);
  if (transferRace.filter((result) => !result.error).length !== 1)
    throw new Error("Two-transfer race did not produce exactly one dispatch.");
  const mixedTransfer = await transfer(ids.variantB, "Sale transfer race", 6);
  const sale = await client.rpc("create_sale", {
    target_branch: ids.source,
    target_customer: ids.customer,
    due_on: null,
    sale_notes: "Sale transfer concurrency",
    sale_discount: 0,
    discount_reason: null,
    items: [
      {
        variant_id: ids.variantB,
        quantity: 7,
        price_type: "RETAIL",
        discount_amount: 0,
      },
    ],
  });
  if (sale.error) throw sale.error;
  const mixedRace = await Promise.all([
    client.rpc("dispatch_transfer", {
      target_transfer: mixedTransfer,
      operation_id: crypto.randomUUID(),
    }),
    client.rpc("complete_sale", {
      target_sale: sale.data,
      operation_id: crypto.randomUUID(),
      initial_payment: 0,
      method: null,
      payment_reference: null,
      payment_notes: null,
    }),
  ]);
  if (mixedRace.filter((result) => !result.error).length !== 1)
    throw new Error(
      "Sale-vs-transfer race did not produce exactly one completion.",
    );
  for (const variant of [ids.variantA, ids.variantB]) {
    const balance = await admin
      .from("branch_inventory")
      .select("quantity_on_hand")
      .eq("branch_id", ids.source)
      .eq("variant_id", variant)
      .single();
    const movements = await admin
      .from("stock_movements")
      .select("quantity_delta")
      .eq("branch_id", ids.source)
      .eq("variant_id", variant);
    const ledger = (movements.data ?? []).reduce(
      (total, movement) => total + Number(movement.quantity_delta),
      0,
    );
    if (
      balance.error ||
      Number(balance.data.quantity_on_hand) < 0 ||
      ledger !== Number(balance.data.quantity_on_hand)
    )
      throw new Error("Transfer concurrency broke inventory reconciliation.");
  }
  process.stdout.write(
    "Transfer concurrency PASS: two-transfer and sale-vs-transfer overselling prevented.\n",
  );
}
main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : "Transfer concurrency failed."}\n`,
  );
  process.exitCode = 1;
});
