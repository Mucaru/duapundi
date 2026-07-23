"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { AlertTriangle, RotateCw } from "lucide-react";
import { db } from "@/lib/db/schema";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { MAX_RETRY, resetStuckItems } from "@/lib/sync/push";
import { useState } from "react";

interface SyncLogSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export function SyncLogSheet({ open, onOpenChange }: SyncLogSheetProps) {
  const [retrying, setRetrying] = useState(false);
  const items = useLiveQuery(
    () => db.sync_queue.orderBy("client_timestamp").reverse().toArray(),
    []
  );

  async function handleRetryAll() {
    setRetrying(true);
    await resetStuckItems();
    setRetrying(false);
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
      </SheetContent>
    </Sheet>
  );
}
