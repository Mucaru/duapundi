import { db } from "./schema";
import { createClient } from "@/lib/supabase/client";

/**
 * Dipanggil sekali di client saat home page mount, kalau Dexie masih
 * kosong (first load / device baru). Setelah ini, SEMUA baca selanjutnya
 * lewat Dexie — bootstrap tidak dipanggil ulang tiap render.
 *
 * Kenapa terpisah dari sync engine (Tahap 5.3): bootstrap adalah
 * "pull satu arah, satu kali" untuk data referensi (wallet, category,
 * household, profile anggota) yang jarang berubah. Sync engine nanti
 * menangani push/pull dua arah yang berkelanjutan untuk transaksi.
 * Memisahkan ini bikin kita bisa uji CRUD lokal dulu tanpa kompleksitas
 * sync sama sekali, sesuai urutan build yang kita sepakati.
 */
export async function bootstrapLocalDb(): Promise<{
  householdId: string | null;
}> {
  const existingHousehold = await db.households.toCollection().first();
  if (existingHousehold) {
    return { householdId: existingHousehold.id };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { householdId: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, name, household_id, created_at")
    .eq("id", user.id)
    .single();

  if (!profile?.household_id) return { householdId: null };

  const [{ data: household }, { data: wallets }, { data: categories }, { data: members }] =
    await Promise.all([
      supabase
        .from("households")
        .select("id, name, invite_code, created_by, created_at")
        .eq("id", profile.household_id)
        .single(),
      supabase
        .from("wallets")
        .select("*")
        .eq("household_id", profile.household_id)
        .is("deleted_at", null),
      supabase
        .from("categories")
        .select("*")
        .eq("household_id", profile.household_id)
        .is("deleted_at", null),
      supabase
        .from("profiles")
        .select("id, email, name, household_id, created_at")
        .eq("household_id", profile.household_id),
    ]);

  await db.transaction(
    "rw",
    [db.households, db.wallets, db.categories, db.users],
    async () => {
      if (household) await db.households.put(household);
      if (wallets) await db.wallets.bulkPut(wallets);
      if (categories) await db.categories.bulkPut(categories);
      if (members) await db.users.bulkPut(members);
    }
  );

  return { householdId: profile.household_id };
}
