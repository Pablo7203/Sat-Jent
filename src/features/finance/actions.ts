"use server";
/**
 * Finance actions manage accounts, expenses, payments, and reconciliation behind permission checks.
 */

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/authorization";
import { createClient } from "@/lib/supabase/server";

const value = (form: FormData, key: string) => String(form.get(key) ?? "");
const values = (form: FormData, key: string) => form.getAll(key).map(String);
const fail = (message?: string) => {
  if (message) throw new Error(message);
};

export async function createFinancialAccount(form: FormData) {
  const context = await requirePermission("finance.accounts.manage");
  const branches = values(form, "branchIds").filter((id) =>
    context.accessibleBranches.some((branch) => branch.id === id),
  );
  if (!branches.length)
    throw new Error("Assign the account to at least one accessible branch.");
  const client = await createClient();
  const { data, error } = await client.rpc("create_financial_account", {
    account_code: value(form, "code").trim().toUpperCase(),
    account_name: value(form, "name").trim(),
    account_kind: value(form, "type"),
    target_branches: branches,
  });
  fail(error?.message);
  revalidatePath("/app/finance");
  if (data) {
    const opening = value(form, "openingAmount");
    if (opening && Number(opening) > 0) {
      const { error: openingError } = await client.rpc(
        "initialize_financial_account",
        {
          target_account: data,
          target_branch: branches[0],
          operation_id: randomUUID(),
          opening_amount: Number(opening),
          opening_on: value(form, "openingDate"),
          opening_note: value(form, "openingNote") || "Initial account balance",
        },
      );
      fail(openingError?.message);
    }
  }
  revalidatePath("/app/finance");
}

export async function postAccountOpening(form: FormData) {
  await requirePermission("finance.accounts.manage");
  const client = await createClient();
  const { error } = await client.rpc("initialize_financial_account", {
    target_account: value(form, "accountId"),
    target_branch: value(form, "branchId"),
    operation_id: value(form, "operationId") || randomUUID(),
    opening_amount: Number(value(form, "amount")),
    opening_on: value(form, "date"),
    opening_note: value(form, "note"),
  });
  fail(error?.message);
  revalidatePath("/app/finance");
}

export async function reconcileAccount(form: FormData) {
  await requirePermission("finance.reconcile");
  const client = await createClient();
  const { error } = await client.rpc("record_financial_reconciliation", {
    target_account: value(form, "accountId"),
    target_branch: value(form, "branchId"),
    statement_on: value(form, "date"),
    statement_amount: Number(value(form, "amount")),
    reconciliation_note: value(form, "note"),
  });
  fail(error?.message);
  revalidatePath("/app/finance");
}

export async function createExpense(form: FormData) {
  await requirePermission("expenses.create");
  const client = await createClient();
  const { error } = await client.rpc("create_expense", {
    target_branch: value(form, "branchId"),
    target_category: value(form, "categoryId"),
    expense_description: value(form, "description"),
    expense_on: value(form, "date"),
    expense_amount: Number(value(form, "amount")),
    expense_payee: value(form, "payee") || null,
    receipt_path: null,
    expense_notes: value(form, "notes") || null,
  });
  fail(error?.message);
  revalidatePath("/app/expenses");
}

export async function decideExpense(form: FormData) {
  await requirePermission("expenses.approve");
  const client = await createClient();
  const { error } = await client.rpc("decide_expense", {
    target_expense: value(form, "expenseId"),
    approve: value(form, "decision") === "approve",
    decision_note: value(form, "note") || null,
  });
  fail(error?.message);
  revalidatePath("/app/expenses");
}

export async function payExpense(form: FormData) {
  await requirePermission("expenses.pay");
  const client = await createClient();
  const { error } = await client.rpc("pay_expense", {
    target_expense: value(form, "expenseId"),
    target_account: value(form, "accountId"),
    operation_id: value(form, "operationId") || randomUUID(),
    payment_amount: Number(value(form, "amount")),
    payment_on: value(form, "date"),
    reference: value(form, "reference") || null,
    payment_notes: value(form, "notes") || null,
  });
  fail(error?.message);
  revalidatePath("/app/expenses");
  revalidatePath("/app/finance");
}
