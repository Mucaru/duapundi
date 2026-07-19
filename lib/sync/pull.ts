import { db } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/client";
import type { Transaction } from "@/types";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * Merge satu row transaksi yang datang dari server (baik lewat Realtime
 * event maupun reconcile fetch) ke Dexie. Ini jantung dari conflict
 * resolution: row remote MENANG kalau updated_at server-nya lebih baru
 * dari yang kita punya lokal — penuh (whole row), bukan field-level
 * merge. Lihat catatan arsitektur: field-level merge berisiko untuk
 * data keuangan.
 *
 * Kalau ada entry sync_queue yang masih pending untuk id ini, kita
 * TUNDA merge — supaya edit lokal yang belum sempat ke-push gak
 * ketiban perubahan luar duluan. Push engine akan menang belakangan
 * dan hasil finalnya tetap konsisten (server jadi source of truth
 * setelah push kita sukses).
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
  // Kalau local.updated_at lebih baru dari remote (jarang — race condition
  // kecil antara push kita sendiri dan pull), biarkan local menang;
  // push engine kita sendiri yang akan mendorong versi lokal ini ke server.
}

let channel: RealtimeChannel | null = null;

export function subscribeRealtime(householdId: string): () => void {
  const supabase = createClient();

  channel = supabase
    .channel(`household:${householdId}:transactions`)
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
    .subscribe();

  return () => {
    if (channel) {
      supabase.removeChannel(channel);
      channel = null;
    }
  };
}

/**
 * Reconcile fetch — dipanggil sekali tiap kali app kembali online
 * (bukan cuma andalin Realtime, karena event yang terjadi PAS device
 * offline gak akan pernah sampai lewat Realtime; harus di-pull manual).
 * Ambil semua transaksi yang updated_at-nya lebih baru dari waktu
 * terakhir kita reconcile.
 */
export async function reconcileTransactions(householdId: string): Promise<void> {
  const supabase = createClient();
  const lastSync = localStorage.getItem(`last_reconcile:${householdId}`);

  let query = supabase
    .from("transactions")
    .select("*")
    .eq("household_id", householdId);

  if (lastSync) {
    query = query.gt("updated_at", lastSync);
  }

  const { data, error } = await query;
  if (error || !data) return;

  for (const row of data as Transaction[]) {
    await mergeRemoteTransaction(row);
  }

  localStorage.setItem(`last_reconcile:${householdId}`, new Date().toISOString());
}
