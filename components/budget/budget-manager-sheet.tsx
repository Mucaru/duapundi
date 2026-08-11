"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronRight, ChevronLeft, PiggyBank, Plus } from "lucide-react";
import { db } from "@/lib/db/schema";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Numpad } from "@/components/transaction/numpad";
import { upsertBudgetLocal, deleteBudgetLocal } from "@/lib/db/budgets";
import { formatIDR, cn } from "@/lib/utils";

interface BudgetManagerSheetProps {
  householdId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${year}`;
}

export function BudgetManagerSheet({ householdId, open, onOpenChange }: BudgetManagerSheetProps) {
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  const month = currentMonth();
  const monthStart = `${month}-01`;

  const categories = useLiveQuery(
    () =>
      db.categories
        .where("household_id")
        .equals(householdId)
        .filter((c) => c.deleted_at === null && c.type === "expense")
        .toArray(),
    [householdId]
  );

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

  function spentFor(categoryId: string): number {
    return (monthTx ?? [])
      .filter((t) => t.category_id === categoryId)
      .reduce((sum, t) => sum + t.amount, 0);
  }

  function budgetFor(categoryId: string) {
    return (budgets ?? []).find((b) => b.category_id === categoryId) ?? null;
  }

  function closeEditor() {
    setEditingCategoryId(null);
    setAmount("");
  }

  async function handleSaveLimit() {
    if (!editingCategoryId || saving) return;
    const numericAmount = parseInt(amount || "0", 10);
    if (numericAmount <= 0) return;
    setSaving(true);
    await upsertBudgetLocal({
      household_id: householdId,
      category_id: editingCategoryId,
      month,
      limit_amount: numericAmount,
    });
    setSaving(false);
    closeEditor();
  }

  const editingCategory = categories?.find((c) => c.id === editingCategoryId);
  const editingBudget = editingCategoryId ? budgetFor(editingCategoryId) : null;

  // Urutan: kategori yang udah ada limit-nya duluan (paling mendesak
  // persentasenya di atas), baru yang belum ada limit di bawah — biar
  // yang paling butuh perhatian keliatan duluan, bukan urutan acak.
  const sortedCategories = [...(categories ?? [])].sort((a, b) => {
    const budgetA = budgetFor(a.id);
    const budgetB = budgetFor(b.id);
    if (budgetA && !budgetB) return -1;
    if (!budgetA && budgetB) return 1;
    if (budgetA && budgetB) {
      const pctA = spentFor(a.id) / budgetA.limit_amount;
      const pctB = spentFor(b.id) / budgetB.limit_amount;
      return pctB - pctA;
    }
    return a.name.localeCompare(b.name);
  });

  const totalLimit = (budgets ?? []).reduce((sum, b) => sum + b.limit_amount, 0);
  const totalSpent = (budgets ?? []).reduce((sum, b) => sum + spentFor(b.category_id), 0);

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) closeEditor();
      }}
    >
      <SheetContent>
        {editingCategoryId ? (
          <>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={closeEditor}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-surface-muted"
                aria-label="Kembali"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <SheetTitle className="font-display text-xl font-semibold text-ink">
                Limit {editingCategory?.name}
              </SheetTitle>
            </div>
            <p className="mt-1 pl-10 text-sm text-ink-muted">
              {monthLabel(month)} — masukin batas pengeluaran buat kategori ini
            </p>
            <div className="mt-5">
              <Numpad value={amount} onChange={setAmount} />
            </div>
            <div className="mt-5 flex gap-3">
              {editingBudget && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={async () => {
                    await deleteBudgetLocal(editingBudget.id);
                    closeEditor();
                  }}
                >
                  Hapus limit
                </Button>
              )}
              <Button
                className="flex-1"
                disabled={parseInt(amount || "0", 10) <= 0 || saving}
                onClick={handleSaveLimit}
              >
                {saving ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </>
        ) : (
          <>
            <SheetTitle className="font-display text-xl font-semibold text-ink">
              Budget {monthLabel(month)}
            </SheetTitle>

            {totalLimit > 0 && (
              <div className="mt-4 rounded-2xl bg-primary px-4 py-3.5 text-primary-foreground">
                <p className="text-xs text-primary-foreground/70">Total budget bulan ini</p>
                <p className="mt-0.5 font-display text-xl font-semibold tabular-nums">
                  {formatIDR(totalSpent)}{" "}
                  <span className="text-sm font-normal text-primary-foreground/70">
                    / {formatIDR(totalLimit)}
                  </span>
                </p>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/15">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      totalSpent > totalLimit ? "bg-danger" : "bg-white"
                    )}
                    style={{ width: `${Math.min(100, Math.round((totalSpent / totalLimit) * 100))}%` }}
                  />
                </div>
              </div>
            )}

            <div className="mt-4 space-y-2">
              {sortedCategories.map((cat) => {
                const budget = budgetFor(cat.id);
                const spent = spentFor(cat.id);
                const pct = budget
                  ? Math.min(100, Math.round((spent / budget.limit_amount) * 100))
                  : 0;
                const isOver = budget ? spent > budget.limit_amount : false;
                const isNear = budget ? !isOver && pct >= 80 : false;
                const remaining = budget ? budget.limit_amount - spent : 0;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setEditingCategoryId(cat.id);
                      setAmount(budget ? String(budget.limit_amount) : "");
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl bg-surface-muted px-3 py-3 text-left transition-colors active:bg-border"
                  >
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
                      style={{ backgroundColor: `${cat.color}22`, color: cat.color }}
                    >
                      {cat.name.charAt(0)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">{cat.name}</p>
                      {budget ? (
                        <>
                          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-border">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                isOver ? "bg-danger" : isNear ? "bg-accent-warm" : "bg-income"
                              )}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <p className="mt-1 text-xs text-ink-muted">
                            {isOver ? (
                              <span className="text-danger">
                                Lewat {formatIDR(Math.abs(remaining))}
                              </span>
                            ) : (
                              <>Sisa {formatIDR(remaining)}</>
                            )}
                            {" · "}
                            {formatIDR(spent)} / {formatIDR(budget.limit_amount)}
                          </p>
                        </>
                      ) : (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-muted">
                          <Plus className="h-3 w-3" /> Set limit
                        </p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-ink-muted" />
                  </button>
                );
              })}

              {categories?.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <PiggyBank className="h-8 w-8 text-ink-muted" />
                  <p className="text-sm text-ink-muted">
                    Belum ada kategori pengeluaran.
                    <br />
                    Tambah dulu di menu Kategori.
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
