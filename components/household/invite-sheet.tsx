"use client";

import { useState, useTransition } from "react";
import { Copy, Check, Users } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { getHouseholdInviteInfo } from "@/actions/household";

interface InviteInfo {
  household: { id: string; name: string; invite_code: string } | null;
  members: { id: string; name: string }[];
}

export function InviteSheet() {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleOpen(next: boolean) {
    setOpen(next);
    if (next && !info) {
      startTransition(async () => {
        const result = await getHouseholdInviteInfo();
        setInfo(result);
      });
    }
  }

  async function handleCopy() {
    if (!info?.household) return;
    await navigator.clipboard.writeText(info.household.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm">
          <Users className="h-4 w-4" />
          Undang
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetTitle className="font-display text-xl font-semibold text-ink">
          Undang pacar kamu
        </SheetTitle>

        {isPending && !info && (
          <p className="mt-4 text-sm text-ink-muted">Memuat...</p>
        )}

        {info?.household && (
          <>
            <p className="mt-2 text-sm text-ink-muted">
              Bagikan kode ini ke pacar kamu. Mereka tinggal masukkan di halaman
              &quot;Join household&quot; saat daftar akun.
            </p>

            <div className="mt-4 flex items-center gap-2 rounded-2xl border border-border bg-surface-muted px-4 py-3">
              <code className="flex-1 text-lg font-semibold tracking-wide text-ink">
                {info.household.invite_code}
              </code>
              <Button variant="outline" size="icon" onClick={handleCopy}>
                {copied ? (
                  <Check className="h-4 w-4 text-income" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>

            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Anggota household ({info.members.length}/2)
              </p>
              <div className="space-y-1">
                {info.members.map((m) => (
                  <div
                    key={m.id}
                    className="rounded-xl bg-surface px-3 py-2 text-sm text-ink"
                  >
                    {m.name}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {info && !info.household && (
          <p className="mt-4 text-sm text-ink-muted">
            Belum ada household. Ini seharusnya tidak terjadi kalau kamu sudah
            di halaman ini — coba muat ulang.
          </p>
        )}
      </SheetContent>
    </Sheet>
  );
}
