"use client";

import { useState } from "react";
import { X, ListPlus, Check } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Numpad } from "./numpad";
import { createTransactionLocal } from "@/lib/db/transactions";
import type { Category, TransactionType, Wallet } from "@/types";
import { cn, formatIDR } from "@/lib/utils";

interface QueuedItem {
  key: string;
  type: TransactionType;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  amount: number;
}

interface BulkAddSheetProps {
  categories: Category[];
  wallets: Wallet[];
  householdId: string;
  userId: string;
}

/**
 * Alternatif dari form grid multi-baris (versi sebelumnya, dirasa
 * susah dipakai) — sekarang pola-nya SAMA PERSIS kayak quick-add
 * biasa (kategori → numpad → tap tambah), cuma diulang beberapa kali
 * sebelum semuanya disimpan bareng di akhir. Lebih familiar karena
 * gerakannya identik sama flow yang udah biasa dipakai user.
 */
export function BulkAddSheet({ categories, wallets, householdId, userId }: BulkAddSheetProps) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<TransactionType>("expense");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [queue, setQueue] = useState<QueuedItem[]>([]);
  const [saving, setSaving] = useState(false);

  const defaultWallet = wallets.find((w) => !w.is_archived);
  const visibleCategories = categories
    .filter((c) => c.type === type)
    .sort((a, b) => (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0) || a.sort_order - b.sort_order);

  const total = queue.reduce(
    (sum, q) => sum + (q.type === "income" ? q.amount : -q.amount),
    0
  );

  function reset() {
    setQueue([]);
    setAmount("");
    setCategoryId(null);
    setType("expense");
  }

  function handleAddToQueue() {
    const numericAmount = parseInt(amount || "0", 10);
    if (!categoryId || numericAmount <= 0) return;
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) return;

    setQueue((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        type,
        categoryId,
        categoryName: cat.name,
        categoryColor: cat.color,
        amount: numericAmount,
      },
    ]);
    // Reset numpad & kategori buat entry berikutnya, tapi TIPE tetap
    // sama (biasanya orang catat beberapa item dengan tipe yang sama
    // berturut-turut, misal beberapa item belanja).
    setAmount("");
    setCategoryId(null);
  }

  function removeFromQueue(key: string) {
    setQueue((prev) => prev.filter((q) => q.key !== key));
  }

  async function handleSaveAll() {
    if (queue.length === 0 || !defaultWallet || saving) return;
    setSaving(true);
    const today = new Date().toISOString().slice(0, 10);
    for (const item of queue) {
      await createTransactionLocal({
        household_id: householdId,
        wallet_id: defaultWallet.id,
        category_id: item.categoryId,
        user_id: userId,
        amount: item.amount,
        type: item.type,
        note: null,
        date: today,
      });
    }
    setSaving(false);
    reset();
    setOpen(false);
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="bg-surface-muted" aria-label="Input beberapa sekaligus">
          <ListPlus className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetTitle className="font-display text-xl font-semibold text-ink">
          Input beberapa sekaligus
        </SheetTitle>
        <p className="mt-1 text-sm text-ink-muted">
          Sama kayak input biasa — cuma tiap kali tap tambah, langsung lanjut ke transaksi berikutnya.
        </p>

        {/* Antrian transaksi yang udah ditambahin */}
        {queue.length > 0 && (
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {queue.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => removeFromQueue(item.key)}
                className="group flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-surface-muted py-1.5 pl-3 pr-2 text-xs font-medium text-ink"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: item.categoryColor }}
                />
                {item.categoryName} · {item.type === "income" ? "+" : "-"}
                {formatIDR(item.amount)}
                <X className="h-3 w-3 text-ink-muted group-hover:text-danger" />
              </button>
            ))}
          </div>
        )}

        {/* Toggle income/expense — persis quick-add */}
        <div className="mb-4 mt-4 flex rounded-2xl bg-surface-muted p-1">
          <button
            type="button"
            onClick={() => {
              setType("expense");
              setCategoryId(null);
            }}
            className={cn(
              "flex-1 rounded-xl py-2 text-sm font-semibold transition-colors",
              type === "expense" ? "bg-surface text-expense shadow-sm" : "text-ink-muted"
            )}
          >
            Pengeluaran
          </button>
          <button
            type="button"
            onClick={() => {
              setType("income");
              setCategoryId(null);
            }}
            className={cn(
              "flex-1 rounded-xl py-2 text-sm font-semibold transition-colors",
              type === "income" ? "bg-surface text-income shadow-sm" : "text-ink-muted"
            )}
          >
            Pemasukan
          </button>
        </div>

        {/* Kategori — persis quick-add */}
        <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
          {visibleCategories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoryId(cat.id)}
              className={cn(
                "flex shrink-0 flex-col items-center gap-1 rounded-2xl border px-4 py-3 text-xs font-medium transition-colors",
                categoryId === cat.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-surface text-ink-muted"
              )}
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full text-sm"
                style={{ backgroundColor: `${cat.color}22`, color: cat.color }}
              >
                {cat.name.charAt(0)}
              </span>
              {cat.name}
            </button>
          ))}
        </div>

        <Numpad value={amount} onChange={setAmount} />

        <Button
          size="lg"
          variant="outline"
          className="mt-5 w-full"
          disabled={!categoryId || parseInt(amount || "0", 10) <= 0}
          onClick={handleAddToQueue}
        >
          <Check className="h-4 w-4" />
          Tambah ke antrian
        </Button>

        {queue.length > 0 && (
          <>
            <div className="mt-4 flex items-center justify-between rounded-2xl bg-surface-muted px-4 py-3">
              <span className="text-sm text-ink-muted">{queue.length} transaksi diantre</span>
              <span
                className={cn(
                  "text-sm font-semibold tabular-nums",
                  total >= 0 ? "text-income" : "text-expense"
                )}
              >
                {total >= 0 ? "+" : "-"}
                {formatIDR(Math.abs(total))}
              </span>
            </div>
            <Button size="lg" className="mt-3 w-full" disabled={saving} onClick={handleSaveAll}>
              {saving ? "Menyimpan..." : `Simpan ${queue.length} transaksi`}
            </Button>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
