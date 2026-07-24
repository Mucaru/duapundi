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
  } else if (entity === "wallet") {
    await db.wallets.update(id, { updated_at: updatedAt });
  }
}

async function softDeleteOrphanLocal(entity: SyncEntity, id: string): Promise<void> {
  const now = new Date().toISOString();
  if (entity === "transaction") {
    await db.transactions.update(id, { deleted_at: now, updated_at: now });
  } else if (entity === "category") {
    await db.categories.update(id, { deleted_at: now, updated_at: now });
  } else if (entity === "wallet") {
    await db.wallets.update(id, { deleted_at: now, updated_at: now });
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
  const table =
    item.entity === "transaction"
      ? "transactions"
      : item.entity === "category"
        ? "categories"
        : item.entity === "wallet"
          ? "wallets"
          : null;

  if (!table) {
    // budget belum ditangani sync engine — di luar scope MVP saat ini.
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

      if (error) {
        if (error.code === "23505") {
          // Unique violation di primary key (id) — berarti insert kita
          // SEBELUMNYA sebenernya udah sukses di server, cuma response-nya
          // gak sempat nyampe ke client (koneksi kepotong tepat setelah
          // server proses, sebelum balesannya diterima). Retry kedua ini
          // nyoba insert id yang sama, wajar ketabrak constraint. Row-nya
          // UDAH ada di server dengan benar — jangan retry selamanya,
          // cukup selaraskan updated_at lokal dari row yang udah ada itu.
          const { data: existing } = await supabase
            .from(table)
            .select("updated_at")
            .eq("id", item.entity_id)
            .single();
          if (existing) {
            await updateLocalTimestamp(
              item.entity,
              item.entity_id,
              (existing as { updated_at: string }).updated_at
            );
          }
          return true;
        }
        throw error;
      }
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

      if (error) {
        if (error.code === "PGRST116") {
          // Row target gak ada di server sama sekali — data lokal ini
          // "hantu" (kemungkinan besar row-nya dihapus manual dari
          // database, di luar app). Retry gak akan pernah berhasil karena
          // target-nya emang gak ada. Coba insert ulang sebagai tombstone
          // (soft-deleted) dari data lokal yang masih kita punya, biar
          // device lain juga ikut tau row ini harus dianggap terhapus —
          // bukan cuma soft-delete lokal doang yang gak ke-propagate.
          await softDeleteOrphanLocal(item.entity, item.entity_id);
          const orphanNow = new Date().toISOString();
          const tombstonePayload: Record<string, unknown> = {
            ...item.payload,
            deleted_at: orphanNow,
          };
          delete tombstonePayload.updated_at;
          const { error: insertError } = await supabase.from(table).insert(tombstonePayload);
          if (insertError && process.env.NODE_ENV !== "production") {
            // eslint-disable-next-line no-console
            console.warn(
              "[sync] gak bisa bikin tombstone buat row hantu (update):",
              insertError.message
            );
          }
          return true;
        }
        throw error;
      }
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
        if (error.code === "PGRST116") {
          // Row target gak ada di server SAMA SEKALI (bukan cuma belum
          // di-update ke deleted_at) — kemungkinan besar kena hard-delete
          // manual sebelum tombstone sempat kebentuk. Kalau kita cuma
          // "return true" di sini tanpa nulis apapun ke server, device
          // LAIN yang masih nyimpen copy row ini gak akan PERNAH tau row
          // itu harus dihapus — gak ada apapun yang berubah buat mereka
          // reconcile. Jadi INSERT ulang row ini sebagai tombstone
          // (deleted_at udah keisi dari awal) memakai payload penuh yang
          // sekarang selalu dikirim — biar propagate ke device lain.
          const insertPayload = { ...item.payload };
          delete insertPayload.updated_at; // biar trigger server yang isi

          const { error: insertError } = await supabase
            .from(table)
            .insert(insertPayload);

          if (insertError) {
            // Insert tombstone juga gagal (misal FK ke wallet/kategori yang
            // udah gak ada juga) — gak ada cara lain, terima inkonsistensi
            // lokal-only sebagai limitasi yang diketahui, tapi jangan retry
            // selamanya karena percobaan berikutnya juga bakal gagal sama.
            if (process.env.NODE_ENV !== "production") {
              // eslint-disable-next-line no-console
              console.warn(
                "[sync] gak bisa bikin tombstone buat row yang udah hilang total dari server:",
                insertError.message
              );
            }
          }
          return true;
        }
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
      last_attempted_at: new Date().toISOString(),
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
    await db.sync_queue.update(item.id!, {
      retry_count: 0,
      last_error: null,
      last_attempted_at: null,
    });
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
    // Dihitung dari percobaan TERAKHIR (last_attempted_at), bukan dari
    // waktu item pertama kali di-queue (created_at) — kalau pakai
    // created_at, elapsed time terus membesar seiring waktu sementara
    // backoffMs di-cap 2 menit, jadi begitu item udah nangkring >2 menit
    // backoff-nya efektif gak berlaku lagi (retry tiap poll cycle,
    // ngalahin tujuan backoff itu sendiri).
    if (item.retry_count > 0 && item.last_attempted_at) {
      const elapsed = Date.now() - new Date(item.last_attempted_at).getTime();
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
