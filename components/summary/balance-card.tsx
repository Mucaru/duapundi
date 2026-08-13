"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronDown } from "lucide-react";
import { db } from "@/lib/db/schema";
import { listTransactions } from "@/lib/db/transactions";
import { formatIDR, cn } from "@/lib/utils";
import { useTheme } from "@/hooks/use-theme";
import { ThemeMascot } from "@/components/theme/theme-mascot";

interface BalanceCardProps {
  householdId: string;
  greetingName: string;
  members: { id: string; name: string }[];
  currentUserId: string | null;
  // Filter aktif — sama persis yang dipakai TransactionList, biar
  // angka di kartu ini selalu match sama riwayat yang lagi ditampilkan.
  dateFrom?: string | null;
  dateTo?: string | null;
  categoryId?: string | null;
  userFilter?: string | null;
  walletId?: string | null;
  rangeLabel: string;
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
  dateFrom,
  dateTo,
  categoryId,
  userFilter,
  walletId,
  rangeLabel,
}: BalanceCardProps) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const { theme } = useTheme();

  // Angka utama (saldo/pemasukan/pengeluaran) ngikutin filter yang lagi
  // aktif — query-nya lewat listTransactions, index household_id di
  // Dexie (bukan full scan), 100% lokal, gak nyentuh Supabase.
  const filteredTx = useLiveQuery(
    () =>
      listTransactions(householdId, {
        from: dateFrom,
        to: dateTo,
        categoryId,
        userId: userFilter,
        walletId,
      }),
    [householdId, dateFrom, dateTo, categoryId, userFilter, walletId]
  );

  const income = (filteredTx ?? [])
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
  const expense = (filteredTx ?? [])
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);
  const balance = income - expense;

  const expenseByUser = members.map((m) => ({
    ...m,
    total: (filteredTx ?? [])
      .filter((t) => t.type === "expense" && t.user_id === m.id)
      .reduce((sum, t) => sum + t.amount, 0),
  }));

  // Streak SENGAJA gak ikut filter — ini "rekor pencatatan harian"
  // absolut, gak masuk akal kalau difilter kategori/orang tertentu.
  // Query terpisah, ringan (cuma 30 hari terakhir via index household_id).
  const recentTx = useLiveQuery(
    () =>
      db.transactions
        .where("household_id")
        .equals(householdId)
        .filter((t) => t.deleted_at === null && t.date >= startOfMonth())
        .toArray(),
    [householdId]
  );
  const streakDays = (() => {
    if (!recentTx) return 0;
    const dates = new Set(recentTx.map((t) => t.date));
    let streak = 0;
    const cursor = new Date();
    while (dates.has(cursor.toISOString().slice(0, 10))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  })();

  return (
    <div className="theme-card-shell relative mx-6 mt-6 overflow-hidden rounded-3xl px-6 py-7 text-primary-foreground">
      <ThemeMascot theme={theme} className="absolute -right-2 -top-2 h-24 w-24 opacity-90" />
      <p className="text-sm text-primary-foreground/80">Halo, {greetingName} 👋</p>
      <p
        key={balance}
        className="animate-number mt-1 font-display text-4xl font-semibold tabular-nums"
      >
        {formatIDR(balance)}
      </p>
      <p className="mt-1 text-xs text-primary-foreground/70">Saldo · {rangeLabel}</p>

      <div className="mt-5 flex gap-4">
        <div className="flex-1 rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-sm">
          <p className="text-xs text-primary-foreground/70">Pemasukan</p>
          <p className="mt-0.5 font-semibold tabular-nums">{formatIDR(income)}</p>
        </div>
        <div className="flex-1 rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-sm">
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
        <div className="mt-4 border-t border-white/10 pt-3">
          <button
            type="button"
            onClick={() => setShowBreakdown((v) => !v)}
            className="flex w-full items-center justify-between text-xs text-primary-foreground/70"
          >
            Pengeluaran per orang · {rangeLabel}
            <ChevronDown
              className={cn("h-3.5 w-3.5 transition-transform", showBreakdown && "rotate-180")}
            />
          </button>
          {showBreakdown && (
            <div className="mt-2 space-y-1.5">
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
      )}
    </div>
  );
}
