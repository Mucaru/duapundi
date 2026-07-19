"use client";

import { useEffect } from "react";
import { startSyncEngine } from "@/lib/sync/engine";

export function SyncProvider({ householdId }: { householdId: string }) {
  useEffect(() => {
    const handle = startSyncEngine(householdId);
    return () => handle.stop();
  }, [householdId]);

  return null;
}
