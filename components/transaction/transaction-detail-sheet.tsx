"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { Category, Transaction } from "@/types";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Numpad } from "./numpad";
import { updateTransactionLocal, deleteTransactionLocal } from "@/lib/db/transactions";
import { cn } from "@/lib/utils";

interface TransactionDetailSheetProps {
  transaction: Transaction | null;
  categories: Category[];
  userId: string;
  onClose: () => void;
}

/**
 * Form terpisah, di-key oleh transaction.id di parent — jadi tiap kali
 * transaksi yang dipilih beda, komponen ini remount total dengan state
 * awal yang benar (bukan lewat useEffect+setState yang bikin cascading
 * render dan gak disarankan React terbaru).
 */
function TransactionEditForm({
  transaction,
  categories,
  userId,
  onClose,
}: {
  transaction: Transaction;
  categories: Category[];
  userId: string;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(String(transaction.amount));
  const [categoryId, setCategoryId] = useState<string | null>(transaction.category_id);
  const [note, setNote] = useState(transaction.note ?? "");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const visibleCategories = categories
    .filter((c) => c.type === transaction.type)
    .sort((a, b) => (b.is_favorite ? 1 : 0) - (a.is_favorite ? 1 : 0) || a.sort_order - b.sort_order);

  const hasChanges =
    parseInt(amount || "0", 10) !== transaction.amount ||
    categoryId !== transaction.category_id ||
    note !== (transaction.note ?? "");

  async function handleSave() {
    if (!categoryId || !amount || saving) return;
    setSaving(true);
    await updateTransactionLocal(
      transaction.id,
      { amount: parseInt(amount, 10), category_id: categoryId, note: note || null },
      userId
    );
    setSaving(false);
    onClose();
  }

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    await deleteTransactionLocal(transaction.id, userId);
    setDeleting(false);
    setConfirmDelete(false);
    onClose();
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <SheetTitle className="font-display text-xl font-semibold text-ink">
          Edit transaksi
        </SheetTitle>
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="mr-8 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-danger hover:bg-expense-soft"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Hapus
        </button>
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
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

      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Catatan (opsional)"
        className="mt-4 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted"
      />

      <Button
        size="lg"
        className="mt-5 w-full"
        disabled={!categoryId || !amount || saving || !hasChanges}
        onClick={handleSave}
      >
        {saving ? "Menyimpan..." : hasChanges ? "Simpan perubahan" : "Gak ada perubahan"}
      </Button>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Hapus transaksi ini?"
        description="Transaksi akan dihapus dari riwayat kamu dan pasangan. Aksi ini gak bisa dibatalin dari UI."
        destructive
        confirmLabel="Hapus"
        isPending={deleting}
        onConfirm={handleDelete}
      />
    </>
  );
}

export function TransactionDetailSheet({
  transaction,
  categories,
  userId,
  onClose,
}: TransactionDetailSheetProps) {
  return (
    <Sheet open={transaction !== null} onOpenChange={(next) => !next && onClose()}>
      <SheetContent>
        {transaction && (
          <TransactionEditForm
            key={transaction.id}
            transaction={transaction}
            categories={categories}
            userId={userId}
            onClose={onClose}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
