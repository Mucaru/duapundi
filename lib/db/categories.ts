import { db } from "./schema";
import type { Category, TransactionType } from "@/types";

interface CreateCategoryInput {
  household_id: string;
  name: string;
  type: TransactionType;
  color: string;
}

export async function createCategoryLocal(
  input: CreateCategoryInput
): Promise<Category> {
  const now = new Date().toISOString();
  const existing = await db.categories
    .where("household_id")
    .equals(input.household_id)
    .toArray();
  const maxSort = existing.reduce((max, c) => Math.max(max, c.sort_order), 0);

  const category: Category = {
    id: crypto.randomUUID(),
    household_id: input.household_id,
    name: input.name,
    type: input.type,
    icon: "circle",
    color: input.color,
    is_favorite: false,
    sort_order: maxSort + 1,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };

  await db.transaction("rw", db.categories, db.sync_queue, async () => {
    await db.categories.put(category);
    await db.sync_queue.add({
      entity: "category",
      entity_id: category.id,
      operation: "create",
      payload: category as unknown as Record<string, unknown>,
      client_timestamp: now,
      retry_count: 0,
      last_error: null,
      created_at: now,
    });
  });

  return category;
}

export async function toggleCategoryFavoriteLocal(id: string): Promise<void> {
  const now = new Date().toISOString();

  await db.transaction("rw", db.categories, db.sync_queue, async () => {
    const existing = await db.categories.get(id);
    if (!existing) return;

    const updated: Category = {
      ...existing,
      is_favorite: !existing.is_favorite,
      updated_at: now,
    };

    await db.categories.put(updated);
    await db.sync_queue.add({
      entity: "category",
      entity_id: id,
      operation: "update",
      payload: updated as unknown as Record<string, unknown>,
      client_timestamp: now,
      retry_count: 0,
      last_error: null,
      created_at: now,
    });
  });
}

export async function deleteCategoryLocal(id: string): Promise<void> {
  const now = new Date().toISOString();

  await db.transaction("rw", db.categories, db.sync_queue, async () => {
    const existing = await db.categories.get(id);
    if (!existing) return;

    const updated: Category = { ...existing, deleted_at: now, updated_at: now };
    await db.categories.put(updated);
    await db.sync_queue.add({
      entity: "category",
      entity_id: id,
      operation: "delete",
      payload: updated as unknown as Record<string, unknown>,
      client_timestamp: now,
      retry_count: 0,
      last_error: null,
      created_at: now,
    });
  });
}
