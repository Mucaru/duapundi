import { db } from "@/lib/db/schema";
import { createClient } from "@/lib/supabase/client";

export interface IntegrityReport {
  entity: "transaction" | "category" | "wallet";
  localCount: number;
  serverCount: number;
  localOnlyPending: string[]; // ada lokal, gak ada server, TAPI masih di sync_queue — wajar, tinggal nunggu
  localOnlySuspicious: string[]; // ada lokal, gak ada server, DAN gak ada di sync_queue — mencurigakan
  serverOnlyIds: string[]; // ada di server, gak ada lokal (belum ke-reconcile)
  match: boolean;
}

/**
 * Bandingin data lokal (Dexie) vs server (Supabase) buat satu household.
 * Cuma bandingin ID dan JUMLAH row yang gak soft-deleted — bukan
 * bandingin isi field satu-satu (itu tanggung jawab conflict resolution
 * yang udah jalan otomatis lewat sync engine). Tujuan tool ini murni
 * ngasih tau "ada yang ketinggalan atau nyangkut, gak" — supaya masalah
 * kayak tombstone yang gagal propagate bisa ketauan PROAKTIF, bukan
 * nunggu user ngeh dari gejala di UI.
 */
export async function runIntegrityCheck(householdId: string): Promise<IntegrityReport[]> {
  const supabase = createClient();
  const reports: IntegrityReport[] = [];

  const pendingQueueIds = new Set(
    (await db.sync_queue.toArray()).map((i) => i.entity_id)
  );

  const configs = [
    { entity: "transaction" as const, table: "transactions", localTable: db.transactions },
    { entity: "category" as const, table: "categories", localTable: db.categories },
    { entity: "wallet" as const, table: "wallets", localTable: db.wallets },
  ];

  for (const cfg of configs) {
    const [localRows, serverResult] = await Promise.all([
      cfg.localTable.where("household_id").equals(householdId).toArray(),
      supabase
        .from(cfg.table)
        .select("id, deleted_at")
        .eq("household_id", householdId),
    ]);

    const localActive = new Set(
      localRows.filter((r) => r.deleted_at === null).map((r) => r.id)
    );
    const serverActive = new Set(
      (serverResult.data ?? [])
        .filter((r: { deleted_at: string | null }) => r.deleted_at === null)
        .map((r: { id: string }) => r.id)
    );

    const localOnly = [...localActive].filter((id) => !serverActive.has(id));
    const localOnlyPending = localOnly.filter((id) => pendingQueueIds.has(id));
    const localOnlySuspicious = localOnly.filter((id) => !pendingQueueIds.has(id));
    const serverOnlyIds = [...serverActive].filter((id) => !localActive.has(id));

    reports.push({
      entity: cfg.entity,
      localCount: localActive.size,
      serverCount: serverActive.size,
      localOnlyPending,
      localOnlySuspicious,
      serverOnlyIds,
      match: localOnlySuspicious.length === 0 && serverOnlyIds.length === 0,
    });
  }

  return reports;
}
