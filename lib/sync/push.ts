import { db } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/client";
import type { SyncQueueItem, SyncEntity } from "@/types";

export const MAX_RETRY = 8;

/** Backoff eksponensial ringan: 2s, 4s, 8s, ... maksimal 2 menit. */
function backoffMs(retryCount: number): number {
  return Math.min(2000 * 2 ** retryCount, 120_000);
}

async function updateLocalTimestamp(
  entity: SyncEntity,
  id: string,
  updatedAt: string
): Promise<void> {
  if (entity === "transaction") {
    await db.transactions.update(id, { updated_at: updatedAt });
  } else if (entity === "category") {
    await db.categories.update(id, { updated_at: updatedAt });
  }
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
  const table = item.entity === "transaction" ? "transactions" : item.entity === "category" ? "categories" : null;

  if (!table) {
    // wallet/budget belum ditangani sync engine — di luar scope MVP saat ini.
    return true;
  }

  try {
    if (item.operation === "create") {
      const payload = { ...item.payload };
      delete payload.updated_at; // biar trigger server yang isi, bukan client

      const { data, error } = await supabase
        .from(table)
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      await updateLocalTimestamp(item.entity, item.entity_id, (data as { updated_at: string }).updated_at);
      return true;
    }

    if (item.operation === "update") {
      const payload = { ...item.payload };
      delete payload.updated_at;
      delete payload.id;
      delete payload.created_at;

      const { data, error } = await supabase
        .from(table)
        .update(payload)
        .eq("id", item.entity_id)
        .select()
        .single();

      if (error) throw error;
      await updateLocalTimestamp(item.entity, item.entity_id, (data as { updated_at: string }).updated_at);
      return true;
    }

    if (item.operation === "delete") {
      const { data, error } = await supabase
        .from(table)
        .update({
          deleted_at: item.payload.deleted_at,
          ...(item.entity === "transaction"
            ? { edited_by_user_id: (item.payload as { edited_by_user_id?: string }).edited_by_user_id }
            : {}),
        })
        .eq("id", item.entity_id)
        .select()
        .single();

      if (error) {
        // PGRST116 = 0 baris ke-match. Untuk operasi DELETE, ini berarti
        // row-nya emang udah gak ada di server (misal: pernah dihapus manual
        // langsung dari database, di luar app). Tujuan delete (row absent
        // di server) udah tercapai — anggap sukses, jangan retry selamanya.
        if (error.code === "PGRST116") return true;
        throw error;
      }
      await updateLocalTimestamp(item.entity, item.entity_id, (data as { updated_at: string }).updated_at);
      return true;
    }

    return true;
  } catch (err) {
    // JANGAN log 'err' mentah ke console di production — bisa berisi
    // payload transaksi (data keuangan). Log pesan generik saja.
    const message = err instanceof Error ? err.message : "unknown_error";
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn(
        `[sync] gagal ${item.operation} transaction (id disembunyikan): ${message}`
      );
    }
    await db.sync_queue.update(item.id!, {
      retry_count: item.retry_count + 1,
      last_error: message.slice(0, 200),
    });
    return false;
  }
}

/**
 * Reset item yang udah exceed MAX_RETRY balik ke retry_count 0, dipanggil
 * sekali tiap kali sync engine start (app dibuka). Kenapa perlu: item yang
 * "gagal permanen" bisa aja penyebabnya udah gak berlaku lagi (misal: bug
 * di processItem-nya sendiri udah kefix lewat update app, atau row yang
 * ditarget ternyata sekarang udah valid). Tanpa ini, item stuck bakal
 * nyantol selamanya walau akar masalahnya udah beres.
 */
export async function resetStuckItems(): Promise<number> {
  const stuck = await db.sync_queue.where("retry_count").aboveOrEqual(MAX_RETRY).toArray();
  for (const item of stuck) {
    await db.sync_queue.update(item.id!, { retry_count: 0, last_error: null });
  }
  return stuck.length;
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
