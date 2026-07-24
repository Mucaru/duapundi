"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Wallet as WalletIcon, Archive, Users } from "lucide-react";
import { db } from "@/lib/db/schema";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createWalletLocal, archiveWalletLocal } from "@/lib/db/wallets";
import type { WalletType } from "@/types";
import { cn } from "@/lib/utils";

const WALLET_TYPES: { value: WalletType; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "ewallet", label: "E-wallet" },
  { value: "bank", label: "Bank" },
  { value: "business", label: "Bisnis" },
];

interface WalletManagerSheetProps {
  householdId: string;
  userId: string;
  members: { id: string; name: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WalletManagerSheet({
  householdId,
  userId,
  members,
  open,
  onOpenChange,
}: WalletManagerSheetProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<WalletType>("cash");
  const [isPrivate, setIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingArchive, setPendingArchive] = useState<{ id: string; name: string } | null>(null);

  const wallets = useLiveQuery(
    () =>
      db.wallets
        .where("household_id")
        .equals(householdId)
        .filter((w) => !w.is_archived)
        .toArray(),
    [householdId]
  );

  async function handleAdd() {
    if (!name.trim() || saving) return;
    setSaving(true);
    await createWalletLocal({
      household_id: householdId,
      name: name.trim(),
      type,
      owner_user_id: isPrivate ? userId : null,
    });
    setName("");
    setIsPrivate(false);
    setSaving(false);
  }

  function memberName(ownerId: string | null): string {
    if (!ownerId) return "Bersama";
    return members.find((m) => m.id === ownerId)?.name ?? "Privat";
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetTitle className="font-display text-xl font-semibold text-ink">
          Kelola dompet
        </SheetTitle>

        <div className="mt-4 space-y-2">
          {(wallets ?? []).map((w) => (
            <div
              key={w.id}
              className="flex items-center gap-3 rounded-2xl bg-surface-muted px-3 py-2.5"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <WalletIcon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{w.name}</p>
                <p className="flex items-center gap-1 text-xs text-ink-muted">
                  <Users className="h-3 w-3" />
                  {memberName(w.owner_user_id)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPendingArchive({ id: w.id, name: w.name })}
                aria-label="Arsipkan dompet"
              >
                <Archive className="h-4 w-4 text-ink-muted hover:text-danger" />
              </button>
            </div>
          ))}
          {wallets?.length === 0 && (
            <p className="py-4 text-center text-sm text-ink-muted">Belum ada dompet.</p>
          )}
        </div>

        <div className="mt-6 border-t border-border pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Tambah dompet baru
          </p>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="misal: BCA, GoPay, Kas Mucaru Store"
          />

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {WALLET_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setType(t.value)}
                className={cn(
                  "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors",
                  type === t.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-surface text-ink-muted"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <label className="mt-3 flex items-center gap-2 text-sm text-ink-muted">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="h-4 w-4 rounded border-border accent-primary"
            />
            Dompet privat (cuma kamu yang pakai buat transaksi)
          </label>

          <Button
            className="mt-4 w-full"
            onClick={handleAdd}
            disabled={!name.trim() || saving}
          >
            {saving ? "Menyimpan..." : "Tambah dompet"}
          </Button>
        </div>
      </SheetContent>

      <ConfirmDialog
        open={pendingArchive !== null}
        onOpenChange={(next) => !next && setPendingArchive(null)}
        title="Arsipkan dompet?"
        description={
          pendingArchive
            ? `"${pendingArchive.name}" gak akan muncul lagi buat transaksi baru. Transaksi lama yang pakai dompet ini tetap tersimpan.`
            : ""
        }
        destructive
        confirmLabel="Arsipkan"
        onConfirm={() => {
          if (pendingArchive) void archiveWalletLocal(pendingArchive.id);
          setPendingArchive(null);
        }}
      />
    </Sheet>
  );
}
