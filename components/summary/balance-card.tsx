"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/schema";
import { formatIDR } from "@/lib/utils";

interface BalanceCardProps {
  householdId: string;
  greetingName: string;
  members: { id: string; name: string }[];
  currentUserId: string | null;
}

function startOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function BalanceCard({
  householdId,
  greetingName,
  members,
  currentUserId,
}: BalanceCardProps) {
  const monthTx = useLiveQuery(
    () =>
      db.transactions
        .where("household_id")
        .equals(householdId)
        .filter((t) => t.deleted_at === null && t.date >= startOfMonth())
        .toArray(),
    [householdId]
  );

  const income = (monthTx ?? [])
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
  const expense = (monthTx ?? [])
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);
  const balance = income - expense;

  // Breakdown pengeluaran per member — cuma relevan kalau household
  // beranggotakan lebih dari 1 orang.
  const expenseByUser = members.map((m) => ({
    ...m,
    total: (monthTx ?? [])
      .filter((t) => t.type === "expense" && t.user_id === m.id)
      .reduce((sum, t) => sum + t.amount, 0),
  }));

  // Streak sederhana: jumlah hari unik dengan transaksi dalam 30 hari terakhir,
  // berurutan mundur dari hari ini. Sentuhan personal — bukan metrik serius.
  const streakDays = (() => {
    if (!monthTx) return 0;
    const dates = new Set(monthTx.map((t) => t.date));
    let streak = 0;
    const cursor = new Date();
    while (dates.has(cursor.toISOString().slice(0, 10))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  })();

  return (
    <div className="mx-6 mt-6 rounded-3xl bg-primary px-6 py-7 text-primary-foreground">
      <p className="text-sm text-primary-foreground/80">Halo, {greetingName} 👋</p>
      <p className="mt-1 font-display text-4xl font-semibold tabular-nums">
        {formatIDR(balance)}
      </p>
      <p className="mt-1 text-xs text-primary-foreground/70">
        Saldo bulan ini
      </p>

      <div className="mt-5 flex gap-4">
        <div className="flex-1 rounded-2xl bg-white/10 px-4 py-3">
          <p className="text-xs text-primary-foreground/70">Pemasukan</p>
          <p className="mt-0.5 font-semibold tabular-nums">{formatIDR(income)}</p>
        </div>
        <div className="flex-1 rounded-2xl bg-white/10 px-4 py-3">
          <p className="text-xs text-primary-foreground/70">Pengeluaran</p>
          <p className="mt-0.5 font-semibold tabular-nums">{formatIDR(expense)}</p>
        </div>
      </div>

      {streakDays > 1 && (
        <p className="mt-4 text-xs text-primary-foreground/80">
          🌱 Kalian udah nyatet {streakDays} hari berturut-turut
        </p>
      )}

      {members.length > 1 && expense > 0 && (
        <div className="mt-4 space-y-1.5 border-t border-white/10 pt-4">
          <p className="text-xs text-primary-foreground/70">Pengeluaran per orang</p>
          {expenseByUser.map((m) => (
            <div key={m.id} className="flex items-center justify-between text-xs">
              <span className="text-primary-foreground/90">
                {m.id === currentUserId ? "Kamu" : m.name}
              </span>
              <span className="font-semibold tabular-nums">{formatIDR(m.total)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
