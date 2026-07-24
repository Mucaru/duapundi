"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db/schema";
import { formatIDR } from "@/lib/utils";
import type { Category, Transaction, Wallet } from "@/types";

const PAGE_SIZE = 30;

interface TransactionListProps {
  householdId: string;
  categories: Category[];
  wallets: Wallet[];
  members: { id: string; name: string }[];
  currentUserId: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  categoryId?: string | null;
  userFilter?: string | null;
  walletId?: string | null;
  onSelectTransaction?: (transaction: Transaction) => void;
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (dateStr === today) return "Hari ini";
  if (dateStr === yesterday) return "Kemarin";
  return date.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function TransactionList({
  householdId,
  categories,
  wallets,
  members,
  currentUserId,
  dateFrom,
  dateTo,
  categoryId,
  userFilter,
  walletId,
  onSelectTransaction,
}: TransactionListProps) {
  const pendingIds = useLiveQuery(async () => {
    const items = await db.sync_queue.where("entity").equals("transaction").toArray();
    return new Set(items.map((i) => i.entity_id));
  }, []);

  const transactions = useLiveQuery(
    () =>
      db.transactions
        .where("household_id")
        .equals(householdId)
        .filter((t) => {
          if (t.deleted_at !== null) return false;
          if (dateFrom && t.date < dateFrom) return false;
          if (dateTo && t.date > dateTo) return false;
          if (categoryId && t.category_id !== categoryId) return false;
          if (userFilter && t.user_id !== userFilter) return false;
          if (walletId && t.wallet_id !== walletId) return false;
          return true;
        })
        .reverse()
        .sortBy("date"),
    [householdId, dateFrom, dateTo, categoryId, userFilter, walletId]
  );

  function memberLabel(userId: string): string {
    if (userId === currentUserId) return "Kamu";
    return members.find((m) => m.id === userId)?.name ?? "?";
  }

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Reset pagination tiap kali filter berubah — angka "30 pertama" dari
  // hasil filter lama gak relevan lagi buat hasil filter yang baru. Pola
  // "derived state saat render" (bandingin key filter sebelumnya), bukan
  // useEffect+setState, biar gak ada cascading render ekstra.
  const filterKey = `${householdId}|${dateFrom}|${dateTo}|${categoryId}|${userFilter}|${walletId}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setVisibleCount(PAGE_SIZE);
  }

  if (!transactions) {
    return <p className="px-6 text-sm text-ink-muted">Memuat...</p>;
  }

  if (transactions.length === 0) {
    const isFiltered = Boolean(dateFrom || dateTo || categoryId || userFilter || walletId);
    return (
      <div className="px-6 py-16 text-center">
        <p className="text-sm text-ink-muted">
          {isFiltered
            ? "Gak ada transaksi yang cocok sama filter ini."
            : "Belum ada transaksi. Tap tombol + untuk mulai catat."}
        </p>
      </div>
    );
  }

  // Group by date — cuma dari transaksi yang lagi "ditampilkan"
  // (dibatasi pagination), bukan seluruh hasil filter.
  const visibleTransactions = transactions.slice(0, visibleCount);
  const hasMore = transactions.length > visibleCount;

  const groups = visibleTransactions.reduce<Record<string, typeof transactions>>(
    (acc, tx) => {
      (acc[tx.date] ??= []).push(tx);
      return acc;
    },
    {}
  );

  return (
    <div className="space-y-6 px-6 pb-28">
      {Object.entries(groups).map(([date, txs]) => (
        <div key={date}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            {formatDateLabel(date)}
          </p>
          <div className="space-y-1">
            {txs.map((tx) => {
              const category = categories.find((c) => c.id === tx.category_id);
              const isPending = pendingIds?.has(tx.id) ?? false;
              return (
                <button
                  key={tx.id}
                  type="button"
                  onClick={() => onSelectTransaction?.(tx)}
                  className="flex w-full items-center gap-3 rounded-2xl bg-surface px-3 py-3 text-left transition-colors active:bg-surface-muted"
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                    style={{
                      backgroundColor: `${category?.color ?? "#999"}22`,
                      color: category?.color ?? "#999",
                    }}
                  >
                    {category?.name.charAt(0) ?? "?"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {category?.name ?? "Tanpa kategori"}
                    </p>
                    <div className="flex items-center gap-1.5">
                      {tx.note && (
                        <p className="truncate text-xs text-ink-muted">{tx.note}</p>
                      )}
                      {members.length > 1 && (
                        <span className="shrink-0 rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-ink-muted">
                          {memberLabel(tx.user_id)}
                        </span>
                      )}
                      {wallets.length > 1 && (
                        <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          {wallets.find((w) => w.id === tx.wallet_id)?.name ?? "?"}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-sm font-semibold tabular-nums ${
                        tx.type === "income" ? "text-income" : "text-expense"
                      }`}
                    >
                      {tx.type === "income" ? "+" : "-"}
                      {formatIDR(tx.amount)}
                    </p>
                    {isPending && (
                      <p className="text-[10px] text-accent-warm">Belum sync</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {hasMore && (
        <button
          type="button"
          onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
          className="w-full rounded-2xl border border-border bg-surface py-3 text-sm font-medium text-ink-muted"
        >
          Muat {Math.min(PAGE_SIZE, transactions.length - visibleCount)} transaksi lagi
        </button>
      )}
    </div>
  );
}
