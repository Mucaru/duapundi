"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Star, Trash2 } from "lucide-react";
import { db } from "@/lib/db/schema";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createCategoryLocal,
  toggleCategoryFavoriteLocal,
  deleteCategoryLocal,
} from "@/lib/db/categories";
import type { TransactionType } from "@/types";
import { cn } from "@/lib/utils";

const PALETTE = [
  "#1F5C4E", // primary
  "#2E7D5B", // income
  "#B5533C", // expense
  "#D88C6B", // warm accent
  "#7A6FB0", // ungu lembut
  "#4A7FA6", // biru dusty
  "#B08A3E", // mustard
  "#6E6E6E", // netral abu
];

interface CategoryManagerSheetProps {
  householdId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CategoryManagerSheet({
  householdId,
  open,
  onOpenChange,
}: CategoryManagerSheetProps) {
  const [type, setType] = useState<TransactionType>("expense");
  const [name, setName] = useState("");
  const [color, setColor] = useState(PALETTE[0]);
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

  const categories = useLiveQuery(
    () =>
      db.categories
        .where("household_id")
        .equals(householdId)
        .filter((c) => c.deleted_at === null)
        .toArray(),
    [householdId]
  );

  const visible = (categories ?? [])
    .filter((c) => c.type === type)
    .sort((a, b) => a.sort_order - b.sort_order);

  async function handleAdd() {
    if (!name.trim() || saving) return;
    setSaving(true);
    await createCategoryLocal({ household_id: householdId, name: name.trim(), type, color });
    setName("");
    setSaving(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetTitle className="font-display text-xl font-semibold text-ink">
          Kelola kategori
        </SheetTitle>

        <div className="mt-4 flex rounded-2xl bg-surface-muted p-1">
          <button
            type="button"
            onClick={() => setType("expense")}
            className={cn(
              "flex-1 rounded-xl py-2 text-sm font-semibold transition-colors",
              type === "expense" ? "bg-surface text-expense shadow-sm" : "text-ink-muted"
            )}
          >
            Pengeluaran
          </button>
          <button
            type="button"
            onClick={() => setType("income")}
            className={cn(
              "flex-1 rounded-xl py-2 text-sm font-semibold transition-colors",
              type === "income" ? "bg-surface text-income shadow-sm" : "text-ink-muted"
            )}
          >
            Pemasukan
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {visible.map((cat) => (
            <div
              key={cat.id}
              className="flex items-center gap-3 rounded-2xl bg-surface-muted px-3 py-2.5"
            >
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
                style={{ backgroundColor: `${cat.color}22`, color: cat.color }}
              >
                {cat.name.charAt(0)}
              </span>
              <span className="flex-1 text-sm font-medium text-ink">{cat.name}</span>
              <button
                type="button"
                onClick={() => void toggleCategoryFavoriteLocal(cat.id)}
                aria-label="Tandai favorit"
              >
                <Star
                  className={cn(
                    "h-4 w-4",
                    cat.is_favorite ? "fill-accent-warm text-accent-warm" : "text-ink-muted"
                  )}
                />
              </button>
              <button
                type="button"
                onClick={() => setPendingDelete({ id: cat.id, name: cat.name })}
                aria-label="Hapus kategori"
              >
                <Trash2 className="h-4 w-4 text-ink-muted hover:text-danger" />
              </button>
            </div>
          ))}
          {visible.length === 0 && (
            <p className="py-4 text-center text-sm text-ink-muted">
              Belum ada kategori {type === "expense" ? "pengeluaran" : "pemasukan"}.
            </p>
          )}
        </div>

        <div className="mt-6 border-t border-border pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Tambah kategori baru
          </p>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nama kategori"
          />
          <div className="mt-3 flex gap-2">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={cn(
                  "h-8 w-8 rounded-full transition-transform",
                  color === c && "scale-110 ring-2 ring-offset-2 ring-primary"
                )}
                style={{ backgroundColor: c }}
                aria-label={`Pilih warna ${c}`}
              />
            ))}
          </div>
          <Button
            className="mt-4 w-full"
            onClick={handleAdd}
            disabled={!name.trim() || saving}
          >
            {saving ? "Menyimpan..." : "Tambah kategori"}
          </Button>
        </div>
      </SheetContent>

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(next) => !next && setPendingDelete(null)}
        title="Hapus kategori?"
        description={
          pendingDelete
            ? `"${pendingDelete.name}" akan dihapus. Transaksi lama yang pakai kategori ini tetap tersimpan, cuma gak bisa dipilih lagi buat transaksi baru.`
            : ""
        }
        destructive
        confirmLabel="Hapus"
        onConfirm={() => {
          if (pendingDelete) void deleteCategoryLocal(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </Sheet>
  );
}
