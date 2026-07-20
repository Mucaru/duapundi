import { db } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/client";
import type { Transaction, Category } from "@/types";

/**
 * Merge satu row (transaksi ATAU kategori) yang datang dari server (baik
 * lewat Realtime event maupun reconcile fetch) ke Dexie. Ini jantung dari
 * conflict resolution: row remote MENANG kalau updated_at server-nya lebih
 * baru dari yang kita punya lokal — penuh (whole row), bukan field-level
 * merge. Lihat catatan arsitektur: field-level merge berisiko untuk data
 * keuangan.
 *
 * Kalau ada entry sync_queue yang masih pending untuk id ini, kita TUNDA
 * merge — supaya edit lokal yang belum sempat ke-push gak ketiban
 * perubahan luar duluan. Push engine akan menang belakangan dan hasil
 * finalnya tetap konsisten (server jadi source of truth setelah push
 * kita sukses).
 */
export async function mergeRemoteTransaction(remote: Transaction): Promise<void> {
  const pendingForThisId = await db.sync_queue
    .where("entity_id")
    .equals(remote.id)
    .and((i) => i.entity === "transaction")
    .count();

  if (pendingForThisId > 0) return;

  const local = await db.transactions.get(remote.id);
  if (!local || new Date(remote.updated_at) >= new Date(local.updated_at)) {
    await db.transactions.put(remote);
  }
}

export async function mergeRemoteCategory(remote: Category): Promise<void> {
  const pendingForThisId = await db.sync_queue
    .where("entity_id")
    .equals(remote.id)
    .and((i) => i.entity === "category")
    .count();

  if (pendingForThisId > 0) return;

  const local = await db.categories.get(remote.id);
  if (!local || new Date(remote.updated_at) >= new Date(local.updated_at)) {
    await db.categories.put(remote);
  }
}

export function subscribeRealtime(householdId: string): () => void {
  const supabase = createClient();

  const channel = supabase
    .channel(`household:${householdId}:sync`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "transactions",
        filter: `household_id=eq.${householdId}`,
      },
      (payload) => {
        const row = (payload.new ?? payload.old) as Transaction | undefined;
        if (row) void mergeRemoteTransaction(row);
      }
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "categories",
        filter: `household_id=eq.${householdId}`,
      },
      (payload) => {
        const row = (payload.new ?? payload.old) as Category | undefined;
        if (row) void mergeRemoteCategory(row);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Reconcile fetch — dipanggil sekali tiap kali app kembali online (bukan
 * cuma andalin Realtime, karena event yang terjadi PAS device offline gak
 * akan pernah sampai lewat Realtime; harus di-pull manual). Ambil semua
 * row (transaksi + kategori) yang updated_at-nya lebih baru dari waktu
 * terakhir kita reconcile.
 */
export async function reconcileAll(householdId: string): Promise<void> {
  const supabase = createClient();
  const lastSync = localStorage.getItem(`last_reconcile:${householdId}`);

  let txQuery = supabase.from("transactions").select("*").eq("household_id", householdId);
  let catQuery = supabase.from("categories").select("*").eq("household_id", householdId);

  if (lastSync) {
    txQuery = txQuery.gt("updated_at", lastSync);
    catQuery = catQuery.gt("updated_at", lastSync);
  }

  const [txResult, catResult] = await Promise.all([txQuery, catQuery]);

  if (txResult.data) {
    for (const row of txResult.data as Transaction[]) {
      await mergeRemoteTransaction(row);
    }
  }
  if (catResult.data) {
    for (const row of catResult.data as Category[]) {
      await mergeRemoteCategory(row);
    }
  }

  localStorage.setItem(`last_reconcile:${householdId}`, new Date().toISOString());
}
