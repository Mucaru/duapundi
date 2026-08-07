import { db } from "./schema";
import type { Budget } from "@/types";

interface UpsertBudgetInput {
  household_id: string;
  category_id: string;
  month: string; // "YYYY-MM"
  limit_amount: number;
}

/**
 * Set limit budget buat kategori+bulan tertentu. Kalau udah ada budget
 * buat kombinasi household+category+month itu (unique constraint di
 * server), UPDATE; kalau belum, CREATE. Household+category+month
 * dipakai sebagai kunci logis, bukan id — user gak perlu tau id budget
 * yang mana, cukup "set limit Belanja bulan ini jadi 500rb".
 */
export async function upsertBudgetLocal(input: UpsertBudgetInput): Promise<Budget> {
  const now = new Date().toISOString();

  const existing = await db.budgets
    .where("household_id")
    .equals(input.household_id)
    .filter(
      (b) =>
        b.deleted_at === null &&
        b.category_id === input.category_id &&
        b.month === input.month
    )
    .first();

  const budget: Budget = existing
    ? { ...existing, limit_amount: input.limit_amount, updated_at: now }
    : {
        id: crypto.randomUUID(),
        household_id: input.household_id,
        category_id: input.category_id,
        month: input.month,
        limit_amount: input.limit_amount,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      };

  await db.transaction("rw", db.budgets, db.sync_queue, async () => {
    await db.budgets.put(budget);
    await db.sync_queue.add({
      entity: "budget",
      entity_id: budget.id,
      operation: existing ? "update" : "create",
      payload: budget as unknown as Record<string, unknown>,
      client_timestamp: now,
      retry_count: 0,
      last_error: null,
      last_attempted_at: null,
      created_at: now,
    });
  });

  return budget;
}

export async function deleteBudgetLocal(id: string): Promise<void> {
  const now = new Date().toISOString();

  await db.transaction("rw", db.budgets, db.sync_queue, async () => {
    const existing = await db.budgets.get(id);
    if (!existing) return;

    const updated: Budget = { ...existing, deleted_at: now, updated_at: now };
    await db.budgets.put(updated);
    await db.sync_queue.add({
      entity: "budget",
      entity_id: id,
      operation: "delete",
      payload: updated as unknown as Record<string, unknown>,
      client_timestamp: now,
      retry_count: 0,
      last_error: null,
      last_attempted_at: null,
      created_at: now,
    });
  });
}
