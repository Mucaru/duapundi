import Dexie, { type EntityTable } from "dexie";
import type {
  User,
  Household,
  Wallet,
  Category,
  Transaction,
  Budget,
  SyncQueueItem,
} from "@/types";

/**
 * MoneyTrackerDB — local-first source of truth.
 *
 * Prinsip: UI SELALU baca dari sini, tidak pernah langsung dari Supabase.
 * Supabase cuma dipakai oleh sync engine (lib/sync/) untuk push/pull di
 * background. Ini yang bikin app tetap instan walau offline total.
 *
 * Index design notes:
 * - `[household_id+deleted_at]` compound index dipakai untuk query list yang
 *   paling sering: "semua transaksi household ini yang belum dihapus".
 * - `date` di-index terpisah untuk filter riwayat by tanggal.
 * - Primary key semua tabel data adalah string UUID yang di-generate di
 *   CLIENT (bukan auto-increment), supaya row bisa dibuat offline tanpa
 *   perlu round-trip ke server dulu untuk dapat ID.
 */
export class MoneyTrackerDB extends Dexie {
  users!: EntityTable<User, "id">;
  households!: EntityTable<Household, "id">;
  wallets!: EntityTable<Wallet, "id">;
  categories!: EntityTable<Category, "id">;
  transactions!: EntityTable<Transaction, "id">;
  budgets!: EntityTable<Budget, "id">;
  sync_queue!: EntityTable<SyncQueueItem, "id">;

  constructor() {
    super("money-tracker-db");

    this.version(1).stores({
      users: "id, household_id",
      households: "id",
      wallets: "id, household_id, [household_id+deleted_at]",
      categories:
        "id, household_id, type, [household_id+deleted_at], [household_id+type+deleted_at]",
      transactions:
        "id, household_id, wallet_id, category_id, date, [household_id+deleted_at], [household_id+date+deleted_at]",
      budgets: "id, household_id, [household_id+month]",
      // ++id = auto-increment, urutan FIFO untuk diproses sync engine
      sync_queue: "++id, entity, entity_id, client_timestamp",
    });
  }
}

export const db = new MoneyTrackerDB();
