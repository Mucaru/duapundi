import { flushQueue } from "./push";
import { reconcileTransactions, subscribeRealtime } from "./pull";
import { setSyncing } from "./status";

const POLL_INTERVAL_MS = 15_000;

export interface SyncHandle {
  stop: () => void;
}

/**
 * Titik orkestrasi tunggal. Dipanggil sekali per household aktif
 * (lihat components/providers/sync-provider.tsx). Menangani:
 * 1. Push: flush sync_queue tiap kali online berubah jadi true, dan
 *    polling ringan tiap 15 detik selagi online (jaga-jaga event
 *    'online' browser kadang gak fire di semua kondisi).
 * 2. Pull: subscribe Realtime untuk perubahan dari device pacar.
 * 3. Reconcile: sekali tiap online, tangkap perubahan yang terjadi
 *    saat kita offline (Realtime gak bisa reconstruct histori).
 */
export function startSyncEngine(householdId: string): SyncHandle {
  let stopped = false;
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  async function runPushCycle() {
    if (stopped || !navigator.onLine) return;
    setSyncing(true);
    try {
      await flushQueue();
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.warn("[sync] push cycle error:", err instanceof Error ? err.message : err);
      }
    } finally {
      setSyncing(false);
    }
  }

  async function runFullCycle() {
    if (stopped || !navigator.onLine) return;
    setSyncing(true);
    try {
      await reconcileTransactions(householdId);
      await flushQueue();
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.warn("[sync] full cycle error:", err instanceof Error ? err.message : err);
      }
    } finally {
      setSyncing(false);
    }
  }

  const unsubscribeRealtime = subscribeRealtime(householdId);

  const handleOnline = () => void runFullCycle();
  window.addEventListener("online", handleOnline);

  // Jalankan sekali di awal kalau kebetulan udah online saat mount.
  void runFullCycle();

  pollTimer = setInterval(() => void runPushCycle(), POLL_INTERVAL_MS);

  return {
    stop: () => {
      stopped = true;
      window.removeEventListener("online", handleOnline);
      if (pollTimer) clearInterval(pollTimer);
      unsubscribeRealtime();
    },
  };
}
