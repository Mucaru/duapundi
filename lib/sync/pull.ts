import { db } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/client";
import type { Transaction, Category, Wallet } from "@/types";

/**
 * Merge satu row (transaksi/kategori/wallet) yang datang dari server (baik
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

export async function mergeRemoteWallet(remote: Wallet): Promise<void> {
  const pendingForThisId = await db.sync_queue
    .where("entity_id")
    .equals(remote.id)
    .and((i) => i.entity === "wallet")
    .count();

  if (pendingForThisId > 0) return;

  const local = await db.wallets.get(remote.id);
  if (!local || new Date(remote.updated_at) >= new Date(local.updated_at)) {
    await db.wallets.put(remote);
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
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "wallets",
        filter: `household_id=eq.${householdId}`,
      },
      (payload) => {
        const row = (payload.new ?? payload.old) as Wallet | undefined;
        if (row) void mergeRemoteWallet(row);
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
 * row (transaksi + kategori + wallet) yang updated_at-nya lebih baru dari
 * waktu terakhir kita reconcile.
 */
export async function reconcileAll(householdId: string): Promise<void> {
  const supabase = createClient();
  const storageKey = `last_reconcile:${householdId}`;
  const lastSync = localStorage.getItem(storageKey);

  let txQuery = supabase.from("transactions").select("*").eq("household_id", householdId);
  let catQuery = supabase.from("categories").select("*").eq("household_id", householdId);
  let walletQuery = supabase.from("wallets").select("*").eq("household_id", householdId);

  if (lastSync) {
    txQuery = txQuery.gt("updated_at", lastSync);
    catQuery = catQuery.gt("updated_at", lastSync);
    walletQuery = walletQuery.gt("updated_at", lastSync);
  }

  const [txResult, catResult, walletResult] = await Promise.all([
    txQuery,
    catQuery,
    walletQuery,
  ]);

  // Kalau ADA SATU AJA query yang gagal (misal network kepotong di
  // tengah), JANGAN majuin checkpoint. Kalau tetap dimajuin, perubahan
  // yang kelewat di window ini hilang permanen — reconcile berikutnya
  // cuma nyari yang lebih baru dari checkpoint, jadi window yang gagal
  // tadi gak akan pernah di-retry. Lebih aman reconcile ulang window
  // yang sama (idempotent, gak masalah proses dobel) daripada diam-diam
  // kehilangan data.
  const hadError = Boolean(txResult.error || catResult.error || walletResult.error);

  // Checkpoint baru = updated_at TERBESAR dari data yang beneran
  // ke-fetch (server-authoritative), BUKAN jam device (new Date()).
  // Kalau jam device kamu meleset dikit aja ke depan, pakai jam device
  // sebagai checkpoint bisa bikin reconcile berikutnya nyari "lebih
  // baru dari masa depan" — otomatis miss perubahan asli yang
  // timestamp server-nya di belakang jam device yang salah itu.
  let maxUpdatedAt = lastSync;

  if (txResult.data) {
    for (const row of txResult.data as Transaction[]) {
      await mergeRemoteTransaction(row);
      if (!maxUpdatedAt || row.updated_at > maxUpdatedAt) maxUpdatedAt = row.updated_at;
    }
  }
  if (catResult.data) {
    for (const row of catResult.data as Category[]) {
      await mergeRemoteCategory(row);
      if (!maxUpdatedAt || row.updated_at > maxUpdatedAt) maxUpdatedAt = row.updated_at;
    }
  }
  if (walletResult.data) {
    for (const row of walletResult.data as Wallet[]) {
      await mergeRemoteWallet(row);
      if (!maxUpdatedAt || row.updated_at > maxUpdatedAt) maxUpdatedAt = row.updated_at;
    }
  }

  if (!hadError && maxUpdatedAt) {
    localStorage.setItem(storageKey, maxUpdatedAt);
  }
}
