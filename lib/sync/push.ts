import { db } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/client";
import type { SyncQueueItem, Transaction } from "@/types";

export const MAX_RETRY = 8;

/** Backoff eksponensial ringan: 2s, 4s, 8s, ... maksimal 2 menit. */
function backoffMs(retryCount: number): number {
  return Math.min(2000 * 2 ** retryCount, 120_000);
}

/**
 * Proses satu item queue. Return true kalau sukses (item dihapus dari
 * queue), false kalau gagal (item di-update dgn retry_count++).
 *
 * Prinsip penting: setelah push sukses, kita OVERWRITE updated_at lokal
 * dengan nilai dari server (bukan dari client) — supaya conflict
 * resolution ke depan selalu bandingin timestamp yang authoritative,
 * bukan jam device yang bisa salah/beda-beda.
 */
async function processItem(item: SyncQueueItem): Promise<boolean> {
  const supabase = createClient();

  if (item.entity !== "transaction") {
    // Entity lain (category/wallet/budget) belum ditangani sync engine —
    // di luar scope MVP saat ini (kategori/wallet masih read-only setelah
    // bootstrap). Buang dari queue supaya gak nyangkut selamanya.
    return true;
  }

  try {
    if (item.operation === "create") {
      const payload = { ...item.payload };
      delete payload.updated_at; // biar trigger server yang isi, bukan client

      const { data, error } = await supabase
        .from("transactions")
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      await db.transactions.update(item.entity_id, {
        updated_at: (data as Transaction).updated_at,
      });
      return true;
    }

    if (item.operation === "update") {
      const payload = { ...item.payload };
      delete payload.updated_at;
      delete payload.id;
      delete payload.created_at;

      const { data, error } = await supabase
        .from("transactions")
        .update(payload)
        .eq("id", item.entity_id)
        .select()
        .single();

      if (error) throw error;
      await db.transactions.update(item.entity_id, {
        updated_at: (data as Transaction).updated_at,
      });
      return true;
    }

    if (item.operation === "delete") {
      // Soft delete di server juga — tombstone, bukan hard delete.
      const { data, error } = await supabase
        .from("transactions")
        .update({
          deleted_at: item.payload.deleted_at,
          edited_by_user_id: (item.payload as { edited_by_user_id?: string })
            .edited_by_user_id,
        })
        .eq("id", item.entity_id)
        .select()
        .single();

      if (error) throw error;
      await db.transactions.update(item.entity_id, {
        updated_at: (data as Transaction).updated_at,
      });
      return true;
    }

    return true;
  } catch (err) {
    // JANGAN log 'err' mentah ke console di production — bisa berisi
    // payload transaksi (data keuangan). Log pesan generik saja.
    const message = err instanceof Error ? err.message : "unknown_error";
    await db.sync_queue.update(item.id!, {
      retry_count: item.retry_count + 1,
      last_error: message.slice(0, 200),
    });
    return false;
  }
}

/**
 * Proses seluruh queue urut FIFO (client_timestamp). Berhenti kalau
 * ketemu item yang udah exceed MAX_RETRY (anggap perlu intervensi
 * manual / tunggu retry_count di-reset), tapi tetap lanjut proses item
 * lain yang belum exceed — satu transaksi "macet" gak boleh nge-block
 * semua transaksi lain yang sehat.
 */
export async function flushQueue(): Promise<{ processed: number; failed: number }> {
  const items = await db.sync_queue.orderBy("client_timestamp").toArray();
  let processed = 0;
  let failed = 0;

  for (const item of items) {
    if (item.retry_count >= MAX_RETRY) {
      failed++;
      continue;
    }
    // Backoff: skip item yang baru gagal dan belum waktunya dicoba lagi.
    if (item.retry_count > 0) {
      const elapsed = Date.now() - new Date(item.created_at).getTime();
      if (elapsed < backoffMs(item.retry_count)) {
        continue;
      }
    }

    const ok = await processItem(item);
    if (ok) {
      await db.sync_queue.delete(item.id!);
      processed++;
    } else {
      failed++;
    }
  }

  return { processed, failed };
}
