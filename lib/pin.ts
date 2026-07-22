const STORAGE_KEY = "money_tracker_pin_hash";
export const UNLOCKED_SESSION_KEY = "money_tracker_unlocked";

/**
 * PENTING soal batasan keamanan PIN ini (biar gak ada ekspektasi salah):
 * - Ini GATE TAMPILAN, bukan enkripsi. Data di IndexedDB tetap tersimpan
 *   plain text — orang yang cukup teknis (buka DevTools) masih bisa akses
 *   data tanpa PIN sama sekali.
 * - Tujuannya cuma mencegah "casual access" — orang pinjem HP kamu sebentar
 *   terus iseng buka app, bukan proteksi terhadap penyerang serius.
 * - Untuk proteksi data-at-rest yang beneran, perlu enkripsi IndexedDB
 *   (di luar scope MVP ini, dicatat sebagai limitasi yang diketahui).
 */

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function hasPinSet(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(STORAGE_KEY) !== null;
}

export async function setPin(pin: string): Promise<void> {
  const hash = await sha256(pin);
  localStorage.setItem(STORAGE_KEY, hash);
  markUnlocked();
}

export async function verifyPin(pin: string): Promise<boolean> {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return false;
  const hash = await sha256(pin);
  return hash === stored;
}

export function removePin(): void {
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(UNLOCKED_SESSION_KEY);
}

/** "Unlocked" cuma berlaku per tab session (sessionStorage) — tab/app baru selalu minta PIN lagi. */
export function isUnlockedThisSession(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(UNLOCKED_SESSION_KEY) === "1";
}

export function markUnlocked(): void {
  sessionStorage.setItem(UNLOCKED_SESSION_KEY, "1");
}
