import { flushQueue, resetStuckItems } from "./push";
import { reconcileAll, subscribeRealtime } from "./pull";
import { setSyncing } from "./status";
import { withSyncLeaderLock } from "./leader-lock";

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
 *
 * MULTI-TAB: seluruh logic di atas cuma jalan di SATU tab (leader),
 * dikunci pakai Web Locks API (lib/sync/leader-lock.ts). Tab lain di
 * device yang sama tetap berfungsi penuh untuk baca/tulis lokal (Dexie
 * shared antar tab via IndexedDB, jadi tetap reaktif dapet update dari
 * hasil kerja tab leader) — mereka cuma gak jalanin push/pull sendiri,
 * mencegah race condition dua tab berebut proses sync_queue yang sama.
 */
export function startSyncEngine(householdId: string): SyncHandle {
  let stopped = false;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let unsubscribeRealtime: (() => void) | null = null;
  let releaseLock: (() => void) | null = null;

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
      await reconcileAll(householdId);
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

  function handleOnline() {
    void runFullCycle();
  }

  // Kerja beneran (subscribe realtime, poll, dst) cuma dijalanin kalau
  // tab ini berhasil jadi leader. Fungsi di dalam lock ini gak pernah
  // resolve sampai stop() dipanggil (tab ditutup/unmount) — begitu itu
  // terjadi, lock dilepas dan tab lain (kalau ada) otomatis jadi leader
  // berikutnya.
  void withSyncLeaderLock(
    () =>
      new Promise<void>((resolve) => {
        releaseLock = resolve;
        if (stopped) {
          resolve();
          return;
        }

        unsubscribeRealtime = subscribeRealtime(householdId);
        window.addEventListener("online", handleOnline);

        async function boot() {
          if (navigator.onLine) {
            await resetStuckItems();
          }
          await runFullCycle();
        }
        void boot();

        pollTimer = setInterval(() => void runPushCycle(), POLL_INTERVAL_MS);
      })
  );

  return {
    stop: () => {
      stopped = true;
      window.removeEventListener("online", handleOnline);
      if (pollTimer) clearInterval(pollTimer);
      unsubscribeRealtime?.();
      releaseLock?.();
    },
  };
}
