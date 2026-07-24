"use client";

import type { Category, Wallet } from "@/types";
import { cn } from "@/lib/utils";

export type DateRangeFilter = "this_month" | "last_month" | "all";

interface TransactionFiltersProps {
  categories: Category[];
  wallets: Wallet[];
  members: { id: string; name: string }[];
  currentUserId: string | null;
  dateRange: DateRangeFilter;
  onDateRangeChange: (value: DateRangeFilter) => void;
  categoryId: string | null;
  onCategoryChange: (value: string | null) => void;
  userFilter: string | null;
  onUserFilterChange: (value: string | null) => void;
  walletId: string | null;
  onWalletChange: (value: string | null) => void;
}

const DATE_RANGE_LABELS: Record<DateRangeFilter, string> = {
  this_month: "Bulan ini",
  last_month: "Bulan lalu",
  all: "Semua",
};

export function TransactionFilters({
  categories,
  wallets,
  members,
  currentUserId,
  dateRange,
  onDateRangeChange,
  categoryId,
  onCategoryChange,
  userFilter,
  onUserFilterChange,
  walletId,
  onWalletChange,
}: TransactionFiltersProps) {
  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(Object.keys(DATE_RANGE_LABELS) as DateRangeFilter[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onDateRangeChange(key)}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
              dateRange === key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-surface text-ink-muted"
            )}
          >
            {DATE_RANGE_LABELS[key]}
          </button>
        ))}
      </div>

      {members.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => onUserFilterChange(null)}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
              userFilter === null
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-surface text-ink-muted"
            )}
          >
            Semua orang
          </button>
          {members.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onUserFilterChange(m.id)}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                userFilter === m.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-surface text-ink-muted"
              )}
            >
              {m.id === currentUserId ? "Kamu" : m.name}
            </button>
          ))}
        </div>
      )}

      {wallets.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => onWalletChange(null)}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
              walletId === null
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-surface text-ink-muted"
            )}
          >
            Semua dompet
          </button>
          {wallets.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => onWalletChange(w.id)}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                walletId === w.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-surface text-ink-muted"
              )}
            >
              {w.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => onCategoryChange(null)}
          className={cn(
            "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
            categoryId === null
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-surface text-ink-muted"
          )}
        >
          Semua kategori
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => onCategoryChange(cat.id)}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
              categoryId === cat.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border bg-surface text-ink-muted"
            )}
          >
            {cat.name}
          </button>
        ))}
      </div>
    </div>
  );
}

export function dateRangeToBounds(range: DateRangeFilter): { from: string | null; to: string | null } {
  const now = new Date();
  if (range === "all") return { from: null, to: null };

  if (range === "this_month") {
    const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    return { from, to: null };
  }

  // last_month
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const from = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}-01`;
  const lastDayOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  const to = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, "0")}-${String(lastDayOfLastMonth).padStart(2, "0")}`;
  return { from, to };
}
