"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { AlertTriangle } from "lucide-react";
import { db } from "@/lib/db/schema";
import { formatIDR } from "@/lib/utils";

interface BudgetWarningBannerProps {
  householdId: string;
  onOpenBudget: () => void;
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function BudgetWarningBanner({ householdId, onOpenBudget }: BudgetWarningBannerProps) {
  const month = currentMonth();
  const monthStart = `${month}-01`;

  const budgets = useLiveQuery(
    () =>
      db.budgets
        .where("household_id")
        .equals(householdId)
        .filter((b) => b.deleted_at === null && b.month === month)
        .toArray(),
    [householdId, month]
  );

  const monthTx = useLiveQuery(
    () =>
      db.transactions
        .where("household_id")
        .equals(householdId)
        .filter((t) => t.deleted_at === null && t.type === "expense" && t.date >= monthStart)
        .toArray(),
    [householdId, monthStart]
  );

  const categories = useLiveQuery(
    () => db.categories.where("household_id").equals(householdId).toArray(),
    [householdId]
  );

  if (!budgets || budgets.length === 0 || !monthTx || !categories) return null;

  const alerts = budgets
    .map((b) => {
      const spent = monthTx
        .filter((t) => t.category_id === b.category_id)
        .reduce((sum, t) => sum + t.amount, 0);
      const pct = spent / b.limit_amount;
      const category = categories.find((c) => c.id === b.category_id);
      return { name: category?.name ?? "?", spent, limit: b.limit_amount, pct };
    })
    .filter((a) => a.pct >= 0.8)
    .sort((a, b) => b.pct - a.pct);

  if (alerts.length === 0) return null;

  const worst = alerts[0];
  const isOver = worst.pct >= 1;

  return (
    <button
      type="button"
      onClick={onOpenBudget}
      className="mx-6 flex items-center gap-2 rounded-2xl border border-accent-warm/40 bg-accent-warm-soft px-4 py-2.5 text-left text-xs text-ink"
    >
      <AlertTriangle className="h-4 w-4 shrink-0 text-accent-warm" />
      <span className="flex-1">
        {isOver
          ? `Budget "${worst.name}" udah lewat (${formatIDR(worst.spent)} / ${formatIDR(worst.limit)})`
          : `Budget "${worst.name}" udah ${Math.round(worst.pct * 100)}% (${formatIDR(worst.spent)} / ${formatIDR(worst.limit)})`}
        {alerts.length > 1 && ` · +${alerts.length - 1} kategori lain`}
      </span>
    </button>
  );
}
