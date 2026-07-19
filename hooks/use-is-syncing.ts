"use client";

import { useEffect, useState } from "react";
import { getSyncing, subscribeSyncing } from "@/lib/sync/status";

export function useIsSyncing(): boolean {
  const [isSyncing, setIsSyncing] = useState(getSyncing);

  useEffect(() => subscribeSyncing(setIsSyncing), []);

  return isSyncing;
}
