"use client";

import { useState } from "react";
import type { Category, TransactionType, Wallet } from "@/types";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Numpad } from "./numpad";
import { createTransactionLocal } from "@/lib/db/transactions";
import { cn } from "@/lib/utils";
import { Plus } from "lucide-react";

interface QuickAddSheetProps {
  categories: Category[];
  wallets: Wallet[];
  householdId: string;
  userId: string;
}

export function QuickAddSheet({
  categories,
  wallets,
  householdId,
  userId,
}: QuickAddSheetProps) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<TransactionType>("expense");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [walletId, setWalletId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [saving, setSaving] = useState(false);

  // Wallet yang bisa dipilih: shared (owner_user_id null) atau privat
  // milik user yang sedang login. Wallet privat pasangan gak muncul.
  const visibleWallets = wallets.filter(
    (w) => !w.is_archived && (w.owner_user_id === null || w.owner_user_id === userId)
  );
  const selectedWallet = visibleWallets.find((w) => w.id === walletId) ?? visibleWallets[0];
  const visibleCategories = categories
    .filter((c) => c.type === type)
    .sort((a, b) => (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0) || a.sort_order - b.sort_order);

  function reset() {
    setCategoryId(null);
    setWalletId(null);
    setAmount("");
    setNote("");
    setShowNote(false);
  }

  async function handleSave() {
    if (!categoryId || !amount || !selectedWallet || saving) return;
    setSaving(true);

    // Optimistic: tulis ke Dexie langsung, gak nunggu apapun. UI (transaction
    // list) baca lewat useLiveQuery jadi otomatis update begitu ini selesai.
    await createTransactionLocal({
      household_id: householdId,
      wallet_id: selectedWallet.id,
      category_id: categoryId,
      user_id: userId,
      amount: parseInt(amount, 10),
      type,
      note: note || null,
      date: new Date().toISOString().slice(0, 10),
    });

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
        <Button
          size="fab"
          className="fixed bottom-6 right-6 z-40"
          aria-label="Catat transaksi baru"
        >
          <Plus className="h-7 w-7" />
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetTitle className="sr-only">Catat transaksi</SheetTitle>

        {/* Toggle income/expense */}
        <div className="mb-4 flex rounded-2xl bg-surface-muted p-1">
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

        {/* Kategori — horizontal scroll, favorit di depan */}
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

        {visibleWallets.length > 1 && (
          <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
            {visibleWallets.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => setWalletId(w.id)}
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                  selectedWallet?.id === w.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-surface text-ink-muted"
                )}
              >
                {w.name}
              </button>
            ))}
          </div>
        )}

        <Numpad value={amount} onChange={setAmount} />

        {showNote ? (
          <input
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Catatan (opsional)"
            className="mt-4 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted"
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowNote(true)}
            className="mt-4 text-sm font-medium text-ink-muted underline decoration-dotted underline-offset-4"
          >
            + Tambah catatan
          </button>
        )}

        <Button
          size="lg"
          className="mt-5 w-full"
          disabled={!categoryId || !amount || saving}
          onClick={handleSave}
        >
          {saving ? "Menyimpan..." : "Simpan"}
        </Button>
      </SheetContent>
    </Sheet>
  );
}
