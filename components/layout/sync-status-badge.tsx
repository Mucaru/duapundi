"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/schema";
import { useOnlineStatus } from "@/hooks/use-online-status";
import { useIsSyncing } from "@/hooks/use-is-syncing";
import { cn } from "@/lib/utils";

export function SyncStatusBadge() {
  const isOnline = useOnlineStatus();
  const isSyncing = useIsSyncing();
  const pendingCount = useLiveQuery(() => db.sync_queue.count(), []) ?? 0;

  let label = "Tersambung";
  let dotClass = "bg-income";

  if (!isOnline) {
    label = pendingCount > 0 ? `Offline · ${pendingCount} belum sync` : "Offline";
    dotClass = "bg-ink-muted";
  } else if (isSyncing) {
    label = `Menyinkronkan ${pendingCount}...`;
    dotClass = "bg-accent-warm";
  } else if (pendingCount > 0) {
    label = `${pendingCount} belum sync`;
    dotClass = "bg-accent-warm";
  }

  return (
    <div className="flex items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1.5 text-xs font-medium text-ink-muted">
      <span className={cn("h-1.5 w-1.5 rounded-full", dotClass)} />
      {label}
    </div>
  );
}
