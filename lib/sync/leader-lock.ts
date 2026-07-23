/**
 * Kalau user buka app di 2+ tab sekaligus (device sama), tiap tab
 * gak boleh jalanin sync engine masing-masing — bisa race condition
 * pas dua tab bareng-bareng coba proses item sync_queue yang sama
 * (baca item sebelum salah satu sempat hapus dari queue -> percobaan
 * insert dobel -> conflict).
 *
 * Solusinya pakai Web Locks API (navigator.locks) — built-in browser,
 * gak perlu library tambahan. Cuma satu tab yang bisa pegang lock
 * `money-tracker-sync-leader` dalam satu waktu; tab lain otomatis
 * nunggu (dan baru dapet lock kalau tab leader ditutup).
 *
 * Fallback: browser lama yang gak support Web Locks API (jarang
 * banget di 2026) akan langsung jalanin callback tanpa proteksi —
 * degradasi graceful, bukan crash.
 */
export async function withSyncLeaderLock(
  callback: () => Promise<void>
): Promise<void> {
  if (typeof navigator === "undefined" || !("locks" in navigator)) {
    await callback();
    return;
  }

  await navigator.locks.request("money-tracker-sync-leader", async () => {
    await callback();
  });
}
