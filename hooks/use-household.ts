"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/schema";
import { bootstrapLocalDb } from "@/lib/db/bootstrap";

export function useHousehold() {
  const [bootstrapped, setBootstrapped] = useState(false);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  useEffect(() => {
    bootstrapLocalDb()
      .then(() => setBootstrapped(true))
      .catch(() => {
        // Offline saat pertama kali buka & belum ada data lokal sama sekali —
        // gak banyak yang bisa dilakukan selain kasih tau user buat coba lagi
        // saat online. Kalau sudah ada data lokal dari sesi sebelumnya,
        // bootstrapLocalDb resolve duluan tanpa nyentuh network sama sekali.
        setBootstrapError(
          "Belum ada data tersimpan di device ini. Sambungkan internet dulu untuk sinkronisasi awal."
        );
        setBootstrapped(true);
      });
  }, []);

  const household = useLiveQuery(() => db.households.toCollection().first());
  const wallets = useLiveQuery(
    () => (household ? db.wallets.where("household_id").equals(household.id).toArray() : []),
    [household?.id]
  );
  const categories = useLiveQuery(
    () =>
      household
        ? db.categories
            .where("household_id")
            .equals(household.id)
            .filter((c) => c.deleted_at === null)
            .toArray()
        : [],
    [household?.id]
  );
  const members = useLiveQuery(
    () => (household ? db.users.where("household_id").equals(household.id).toArray() : []),
    [household?.id]
  );

  return {
    ready: bootstrapped && household !== undefined,
    bootstrapError,
    household: household ?? null,
    wallets: wallets ?? [],
    categories: categories ?? [],
    members: members ?? [],
  };
}
