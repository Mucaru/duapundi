"use client";

import { useState } from "react";
import { Plus, Trash2, ListPlus } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createTransactionLocal } from "@/lib/db/transactions";
import type { Category, TransactionType, Wallet } from "@/types";
import { cn, formatIDR } from "@/lib/utils";

interface DraftRow {
  key: string;
  type: TransactionType;
  categoryId: string | null;
  amount: string;
  note: string;
}

interface BulkAddSheetProps {
  categories: Category[];
  wallets: Wallet[];
  householdId: string;
  userId: string;
}

function newRow(defaultType: TransactionType = "expense"): DraftRow {
  return {
    key: crypto.randomUUID(),
    type: defaultType,
    categoryId: null,
    amount: "",
    note: "",
  };
}

export function BulkAddSheet({ categories, wallets, householdId, userId }: BulkAddSheetProps) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<DraftRow[]>([newRow(), newRow()]);
  const [saving, setSaving] = useState(false);

  const defaultWallet = wallets.find((w) => !w.is_archived);

  const validRows = rows.filter(
    (r) => r.categoryId && parseInt(r.amount || "0", 10) > 0
  );
  const totalAmount = validRows.reduce((sum, r) => sum + parseInt(r.amount || "0", 10), 0);

  function updateRow(key: string, patch: Partial<DraftRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function removeRow(key: string) {
    setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.key !== key) : prev));
  }

  function addRow() {
    setRows((prev) => [...prev, newRow(prev[prev.length - 1]?.type ?? "expense")]);
  }

  async function handleSaveAll() {
    if (validRows.length === 0 || !defaultWallet || saving) return;
    setSaving(true);

    // Simpan berurutan (bukan Promise.all) — masing-masing createTransactionLocal
    // itu 1 transaksi Dexie atomic sendiri (tulis tabel + antre sync_queue
    // bareng). Jalanin sequential lebih aman buat urutan sync_queue tetap
    // sesuai urutan input, dan tetap murni operasi lokal jadi cepet walau
    // sequential (gak ada round-trip network sama sekali di sini).
    for (const row of validRows) {
      await createTransactionLocal({
        household_id: householdId,
        wallet_id: defaultWallet.id,
        category_id: row.categoryId!,
        user_id: userId,
        amount: parseInt(row.amount, 10),
        type: row.type,
        note: row.note || null,
        date: new Date().toISOString().slice(0, 10),
      });
    }

    setSaving(false);
    setRows([newRow(), newRow()]);
    setOpen(false);
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setRows([newRow(), newRow()]);
      }}
    >
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="bg-surface-muted" aria-label="Input massal">
          <ListPlus className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetTitle className="font-display text-xl font-semibold text-ink">
          Input beberapa sekaligus
        </SheetTitle>
        <p className="mt-1 text-sm text-ink-muted">
          Cocok buat catat belanjaan/struk yang banyak item — isi tiap baris, simpan semua sekali tap.
        </p>

        <div className="mt-4 max-h-[50svh] space-y-3 overflow-y-auto pr-1">
          {rows.map((row, i) => (
            <div key={row.key} className="rounded-2xl border border-border bg-surface-muted p-3">
              <div className="flex items-center justify-between">
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => updateRow(row.key, { type: "expense", categoryId: null })}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-medium",
                      row.type === "expense" ? "bg-expense text-white" : "bg-surface text-ink-muted"
                    )}
                  >
                    Keluar
                  </button>
                  <button
                    type="button"
                    onClick={() => updateRow(row.key, { type: "income", categoryId: null })}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-medium",
                      row.type === "income" ? "bg-income text-white" : "bg-surface text-ink-muted"
                    )}
                  >
                    Masuk
                  </button>
                </div>
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRow(row.key)}
                    aria-label={`Hapus baris ${i + 1}`}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-ink-muted hover:text-danger" />
                  </button>
                )}
              </div>

              <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
                {categories
                  .filter((c) => c.type === row.type)
                  .map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => updateRow(row.key, { categoryId: cat.id })}
                      className={cn(
                        "shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium",
                        row.categoryId === cat.id
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-surface text-ink-muted"
                      )}
                    >
                      {cat.name}
                    </button>
                  ))}
              </div>

              <div className="mt-2 flex gap-2">
                <Input
                  value={row.amount}
                  onChange={(e) =>
                    updateRow(row.key, { amount: e.target.value.replace(/\D/g, "") })
                  }
                  placeholder="Nominal"
                  inputMode="numeric"
                  className="h-10 flex-1 text-sm"
                />
                <Input
                  value={row.note}
                  onChange={(e) => updateRow(row.key, { note: e.target.value })}
                  placeholder="Catatan (opsional)"
                  className="h-10 flex-[1.3] text-sm"
                />
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addRow}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-border py-2.5 text-sm font-medium text-ink-muted"
        >
          <Plus className="h-4 w-4" />
          Tambah baris
        </button>

        <div className="mt-5 flex items-center justify-between rounded-2xl bg-surface-muted px-4 py-3">
          <span className="text-sm text-ink-muted">
            {validRows.length} transaksi siap disimpan
          </span>
          <span className="text-sm font-semibold tabular-nums text-ink">
            {formatIDR(totalAmount)}
          </span>
        </div>

        <Button
          size="lg"
          className="mt-4 w-full"
          disabled={validRows.length === 0 || saving || !defaultWallet}
          onClick={handleSaveAll}
        >
          {saving ? "Menyimpan..." : `Simpan ${validRows.length || ""} transaksi`}
        </Button>
      </SheetContent>
    </Sheet>
  );
}
