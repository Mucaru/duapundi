import { db } from "./schema";
import type { Transaction } from "@/types";

/**
 * Semua mutation transaksi HARUS lewat fungsi-fungsi di file ini.
 * Jangan pernah panggil `db.transactions.put/delete` langsung dari
 * komponen UI — itu akan melewati outbox queue dan transaksi tidak akan
 * pernah ter-sync ke Supabase / device pacar.
 *
 * Pola tiap fungsi: (1) tulis ke tabel data lokal, (2) tulis entry ke
 * sync_queue, dalam SATU Dexie transaction supaya atomic — kalau salah
 * satu gagal, keduanya di-rollback (gak ada state yatim piatu).
 *
 * PENTING: ID transaksi HARUS berformat UUID valid (pakai
 * crypto.randomUUID(), bukan nanoid() atau generator string bebas
 * lainnya) karena kolom `id` di Postgres bertipe `uuid`. ID non-UUID
 * akan bikin insert selalu ditolak server — silent failure yang
 * bikin transaksi nyangkut selamanya di sync_queue.
 */

interface CreateTransactionInput {
  household_id: string;
  wallet_id: string;
  category_id: string;
  user_id: string;
  amount: number;
  type: "income" | "expense";
  note?: string | null;
  date: string;
}

export async function createTransactionLocal(
  input: CreateTransactionInput
): Promise<Transaction> {
  const now = new Date().toISOString();
  const tx: Transaction = {
    id: crypto.randomUUID(),
    household_id: input.household_id,
    wallet_id: input.wallet_id,
    category_id: input.category_id,
    user_id: input.user_id,
    amount: input.amount,
    type: input.type,
    note: input.note ?? null,
    date: input.date,
    is_shared: false,
    split_with: null,
    created_at: now,
    updated_at: now, // akan ditimpa server saat sync sukses
    deleted_at: null,
    edited_by_user_id: input.user_id,
  };

  await db.transaction("rw", db.transactions, db.sync_queue, async () => {
    await db.transactions.put(tx);
    await db.sync_queue.add({
      entity: "transaction",
      entity_id: tx.id,
      operation: "create",
      payload: tx as unknown as Record<string, unknown>,
      client_timestamp: now,
      retry_count: 0,
      last_error: null,
      last_attempted_at: null,
      created_at: now,
    });
  });

  return tx;
}

export async function updateTransactionLocal(
  id: string,
  patch: Partial<
    Pick<
      Transaction,
      "amount" | "category_id" | "wallet_id" | "note" | "date" | "type"
    >
  >,
  editedByUserId: string
): Promise<void> {
  const now = new Date().toISOString();

  await db.transaction("rw", db.transactions, db.sync_queue, async () => {
    const existing = await db.transactions.get(id);
    if (!existing) throw new Error(`Transaction ${id} not found locally`);

    const updated: Transaction = {
      ...existing,
      ...patch,
      updated_at: now,
      edited_by_user_id: editedByUserId,
    };

    await db.transactions.put(updated);
    await db.sync_queue.add({
      entity: "transaction",
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

/** Soft delete — tombstone, bukan hard delete. Lihat lib/sync/README untuk alasan. */
export async function deleteTransactionLocal(
  id: string,
  deletedByUserId: string
): Promise<void> {
  const now = new Date().toISOString();

  await db.transaction("rw", db.transactions, db.sync_queue, async () => {
    const existing = await db.transactions.get(id);
    if (!existing) return;

    const updated: Transaction = {
      ...existing,
      deleted_at: now,
      updated_at: now,
      edited_by_user_id: deletedByUserId,
    };

    await db.transactions.put(updated);
    await db.sync_queue.add({
      entity: "transaction",
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

/** Query untuk UI — hanya baca dari Dexie, tidak pernah touch network. */
export interface TransactionFilterOptions {
  from?: string | null;
  to?: string | null;
  categoryId?: string | null;
  userId?: string | null;
  walletId?: string | null;
}

/**
 * Query filter yang dipakai BARENG oleh TransactionList (UI) dan CSV
 * export — satu sumber kebenaran buat logic filter, biar hasil export
 * selalu match persis sama apa yang lagi ditampilkan di layar, gak ada
 * divergensi logic filter di dua tempat beda.
 *
 * Murni baca dari Dexie lokal (IndexedDB) — TIDAK PERNAH nyentuh
 * network/Supabase sama sekali. Efisien karena Dexie query pakai
 * index household_id (bukan full scan), dan filter tambahan jalan di
 * memory atas hasil yang udah dipersempit itu.
 */
export async function listTransactions(
  householdId: string,
  opts?: TransactionFilterOptions
): Promise<Transaction[]> {
  const items = await db.transactions
    .where("household_id")
    .equals(householdId)
    .filter((t) => {
      if (t.deleted_at !== null) return false;
      if (opts?.from && t.date < opts.from) return false;
      if (opts?.to && t.date > opts.to) return false;
      if (opts?.categoryId && t.category_id !== opts.categoryId) return false;
      if (opts?.userId && t.user_id !== opts.userId) return false;
      if (opts?.walletId && t.wallet_id !== opts.walletId) return false;
      return true;
    })
    .toArray();

  return items.sort((a, b) => b.date.localeCompare(a.date));
}
