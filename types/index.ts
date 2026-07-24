/**
 * Data model inti — struktur ini HARUS sinkron antara:
 * - lib/db/schema.ts (Dexie / IndexedDB, local)
 * - supabase/migrations/*.sql (Postgres, remote)
 *
 * Kenapa Household jadi penghubung:
 * User tidak pernah langsung terhubung ke User lain. Semua shared access
 * (wallet, category, transaction) di-scope lewat household_id. Ini bikin
 * kalau nanti ada fitur "wallet privat" (misal dompet bisnis Mucaru Store
 * yang gak mau ditampilkan default ke pacar), kita tinggal tambah field
 * `visibility` di Wallet tanpa perlu redesain relasi User<->User.
 */

export type TransactionType = "income" | "expense";
export type WalletType = "cash" | "ewallet" | "bank" | "business";
export type SyncStatus = "pending" | "synced" | "failed";

export interface User {
  id: string; // = Supabase auth.users.id
  email: string;
  name: string;
  household_id: string | null;
  created_at: string;
}

export interface Household {
  id: string;
  name: string;
  invite_code: string; // random token, dipakai untuk invite flow, bisa di-regenerate
  created_by: string; // user_id
  created_at: string;
}

export interface Wallet {
  id: string;
  household_id: string;
  name: string;
  type: WalletType;
  owner_user_id: string | null; // null = shared wallet, diisi = wallet privat milik 1 user
  icon: string;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null; // soft delete (tombstone)
}

export interface Category {
  id: string;
  household_id: string;
  name: string;
  type: TransactionType;
  icon: string;
  color: string;
  is_favorite: boolean; // dipakai untuk quick-add row
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Transaction {
  id: string; // client-generated UUID (bukan auto-increment server) — wajib, biar bisa dibuat offline tanpa nunggu server
  household_id: string;
  wallet_id: string;
  category_id: string;
  user_id: string; // siapa yang input
  amount: number; // simpan dalam satuan terkecil (rupiah penuh, integer, no float)
  type: TransactionType;
  note: string | null;
  date: string; // ISO date (tanggal transaksi, bukan created_at)
  is_shared: boolean;
  split_with: { user_id: string; amount: number }[] | null; // fase 2

  // --- Sync metadata ---
  created_at: string; // client timestamp saat dibuat (untuk urutan lokal)
  updated_at: string; // SERVER timestamp, authoritative untuk conflict resolution
  deleted_at: string | null; // tombstone, soft delete
  edited_by_user_id: string; // audit ringan: siapa yang terakhir edit
}

export interface Budget {
  id: string;
  household_id: string;
  category_id: string;
  month: string; // format "YYYY-MM"
  limit_amount: number;
  created_at: string;
  updated_at: string;
}

/**
 * Outbox queue — cuma ada di local (Dexie), tidak ada di Supabase.
 * Ini "buku catatan perubahan" yang belum berhasil dikirim ke server.
 */
export type SyncOperation = "create" | "update" | "delete";
export type SyncEntity = "transaction" | "category" | "wallet" | "budget" | "household";

export interface SyncQueueItem {
  id?: number; // Dexie auto-increment
  entity: SyncEntity;
  entity_id: string;
  operation: SyncOperation;
  payload: Record<string, unknown>;
  client_timestamp: string; // urutan lokal
  retry_count: number;
  last_error: string | null;
  last_attempted_at: string | null; // buat hitung exponential backoff yang bener
  created_at: string;
}
