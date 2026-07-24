"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { AlertTriangle, RotateCw, ShieldCheck, ShieldAlert } from "lucide-react";
import { db } from "@/lib/db/schema";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { MAX_RETRY, resetStuckItems } from "@/lib/sync/push";
import { reconcileAll } from "@/lib/sync/pull";
import { runIntegrityCheck, type IntegrityReport } from "@/lib/sync/integrity-check";
import { useState } from "react";

interface SyncLogSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  householdId: string;
}

const ENTITY_LABEL: Record<string, string> = {
  transaction: "Transaksi",
  category: "Kategori",
  wallet: "Dompet",
  budget: "Budget",
  household: "Household",
};

const OPERATION_LABEL: Record<string, string> = {
  create: "Tambah",
  update: "Ubah",
  delete: "Hapus",
};

export function SyncLogSheet({ open, onOpenChange, householdId }: SyncLogSheetProps) {
  const [retrying, setRetrying] = useState(false);
  const [checking, setChecking] = useState(false);
  const [report, setReport] = useState<IntegrityReport[] | null>(null);
  const items = useLiveQuery(
    () => db.sync_queue.orderBy("client_timestamp").reverse().toArray(),
    []
  );

  async function handleRetryAll() {
    setRetrying(true);
    await resetStuckItems();
    setRetrying(false);
  }

  async function handleIntegrityCheck() {
    setChecking(true);
    setReport(null);
    try {
      // Reconcile dulu biar hasil cek gak ke-false-positive gara-gara
      // sekadar belum sempat pull perubahan terbaru.
      await reconcileAll(householdId);
      const result = await runIntegrityCheck(householdId);
      setReport(result);
    } finally {
      setChecking(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <div className="flex items-center justify-between">
          <SheetTitle className="font-display text-xl font-semibold text-ink">
            Status sync
          </SheetTitle>
          {items && items.some((i) => i.retry_count >= MAX_RETRY) && (
            <Button
              variant="outline"
              size="sm"
              className="mr-8"
              onClick={handleRetryAll}
              disabled={retrying}
            >
              <RotateCw className="h-3.5 w-3.5" />
              {retrying ? "Mencoba..." : "Coba lagi semua"}
            </Button>
          )}
        </div>

        {!items || items.length === 0 ? (
          <p className="mt-6 text-center text-sm text-ink-muted">
            Semua data udah tersinkron. Gak ada yang tertunda.
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {items.map((item) => {
              const isStuck = item.retry_count >= MAX_RETRY;
              return (
                <div
                  key={item.id}
                  className="rounded-2xl border border-border bg-surface-muted p-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-ink">
                      {OPERATION_LABEL[item.operation] ?? item.operation}{" "}
                      {ENTITY_LABEL[item.entity] ?? item.entity}
                    </p>
                    {isStuck ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-danger">
                        <AlertTriangle className="h-3 w-3" />
                        Gagal permanen
                      </span>
                    ) : (
                      <span className="text-xs text-ink-muted">
                        {item.retry_count > 0
                          ? `Percobaan ke-${item.retry_count}`
                          : "Menunggu giliran"}
                      </span>
                    )}
                  </div>
                  {item.last_error && (
                    <p className="mt-1 truncate text-xs text-ink-muted" title={item.last_error}>
                      {item.last_error}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-6 text-xs text-ink-muted">
          Item yang &ldquo;gagal permanen&rdquo; otomatis dicoba lagi tiap kali app dibuka.
          Kalau terus gagal setelah beberapa kali app dibuka, kemungkinan ada
          masalah data yang butuh dicek manual.
        </p>

        <div className="mt-6 border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Cek integritas data
            </p>
            <Button variant="outline" size="sm" onClick={handleIntegrityCheck} disabled={checking}>
              {checking ? "Mengecek..." : "Cek sekarang"}
            </Button>
          </div>

          {report && (
            <div className="mt-3 space-y-2">
              {report.map((r) => (
                <div
                  key={r.entity}
                  className="flex items-start gap-2 rounded-2xl bg-surface-muted p-3"
                >
                  {r.match ? (
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-income" />
                  ) : (
                    <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink">
                      {ENTITY_LABEL[r.entity]}: {r.localCount} lokal, {r.serverCount} server
                    </p>
                    {r.localOnlySuspicious.length > 0 && (
                      <p className="mt-0.5 text-xs text-danger">
                        {r.localOnlySuspicious.length} data cuma ada lokal, gak jelas kenapa
                        (bukan sekadar nunggu antrian) — coba hapus &amp; buat ulang lewat app
                        kalau ini beneran salah satu yang bermasalah.
                      </p>
                    )}
                    {r.serverOnlyIds.length > 0 && (
                      <p className="mt-0.5 text-xs text-accent-warm">
                        {r.serverOnlyIds.length} data ada di server tapi belum masuk sini —
                        udah otomatis ditarik barusan, coba cek ulang riwayat.
                      </p>
                    )}
                    {r.match && (
                      <p className="mt-0.5 text-xs text-ink-muted">Data lokal &amp; server selaras.</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
