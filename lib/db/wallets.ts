import { db } from "./schema";
import type { Wallet, WalletType } from "@/types";

interface CreateWalletInput {
  household_id: string;
  name: string;
  type: WalletType;
  owner_user_id: string | null; // null = shared, diisi = privat milik 1 user
}

export async function createWalletLocal(input: CreateWalletInput): Promise<Wallet> {
  const now = new Date().toISOString();
  const wallet: Wallet = {
    id: crypto.randomUUID(),
    household_id: input.household_id,
    name: input.name,
    type: input.type,
    owner_user_id: input.owner_user_id,
    icon: "wallet",
    is_archived: false,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };

  await db.transaction("rw", db.wallets, db.sync_queue, async () => {
    await db.wallets.put(wallet);
    await db.sync_queue.add({
      entity: "wallet",
      entity_id: wallet.id,
      operation: "create",
      payload: wallet as unknown as Record<string, unknown>,
      client_timestamp: now,
      retry_count: 0,
      last_error: null,
      last_attempted_at: null,
      created_at: now,
    });
  });

  return wallet;
}

export async function archiveWalletLocal(id: string): Promise<void> {
  const now = new Date().toISOString();

  await db.transaction("rw", db.wallets, db.sync_queue, async () => {
    const existing = await db.wallets.get(id);
    if (!existing) return;

    const updated: Wallet = { ...existing, is_archived: true, updated_at: now };
    await db.wallets.put(updated);
    await db.sync_queue.add({
      entity: "wallet",
      entity_id: id,
      operation: "update",
      payload: updated as unknown as Record<string, unknown>,
      client_timestamp: now,
      retry_count: 0,
      last_error: null,
      last_attempted_at: null,
      created_at: now,
    });
  });
}
