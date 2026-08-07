"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronRight } from "lucide-react";
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

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
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

  async function handleSaveLimit() {
    if (!editingCategoryId || !amount || saving) return;
    setSaving(true);
    await upsertBudgetLocal({
      household_id: householdId,
      category_id: editingCategoryId,
      month,
      limit_amount: parseInt(amount, 10),
    });
    setSaving(false);
    setEditingCategoryId(null);
    setAmount("");
  }

  const editingCategory = categories?.find((c) => c.id === editingCategoryId);
  const editingBudget = editingCategoryId ? budgetFor(editingCategoryId) : null;

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setEditingCategoryId(null);
          setAmount("");
        }
      }}
    >
      <SheetContent>
        {editingCategoryId ? (
          <>
            <SheetTitle className="font-display text-xl font-semibold text-ink">
              Limit {editingCategory?.name}
            </SheetTitle>
            <p className="mt-1 text-sm text-ink-muted">
              Bulan {month} — masukin batas pengeluaran buat kategori ini
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
                    setEditingCategoryId(null);
                    setAmount("");
                  }}
                >
                  Hapus limit
                </Button>
              )}
              <Button className="flex-1" disabled={!amount || saving} onClick={handleSaveLimit}>
                {saving ? "Menyimpan..." : "Simpan"}
              </Button>
            </div>
          </>
        ) : (
          <>
            <SheetTitle className="font-display text-xl font-semibold text-ink">
              Budget bulan ini
            </SheetTitle>
            <div className="mt-4 space-y-2">
              {(categories ?? []).map((cat) => {
                const budget = budgetFor(cat.id);
                const spent = spentFor(cat.id);
                const pct = budget
                  ? Math.min(100, Math.round((spent / budget.limit_amount) * 100))
                  : 0;
                const isOver = budget ? spent > budget.limit_amount : false;
                const isNear = budget ? !isOver && pct >= 80 : false;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setEditingCategoryId(cat.id);
                      setAmount(budget ? String(budget.limit_amount) : "");
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl bg-surface-muted px-3 py-3 text-left"
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
                          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-border">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                isOver ? "bg-danger" : isNear ? "bg-accent-warm" : "bg-income"
                              )}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <p className="mt-1 text-xs text-ink-muted">
                            {formatIDR(spent)} / {formatIDR(budget.limit_amount)}
                            {isOver && <span className="ml-1 text-danger">· Lewat limit</span>}
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-ink-muted">Belum ada limit</p>
                      )}
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-ink-muted" />
                  </button>
                );
              })}
              {categories?.length === 0 && (
                <p className="py-6 text-center text-sm text-ink-muted">
                  Belum ada kategori pengeluaran. Tambah dulu di menu Kategori.
                </p>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
