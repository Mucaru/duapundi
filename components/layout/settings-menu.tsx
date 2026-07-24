"use client";

import { useState } from "react";
import { Settings, Tags, Wallet as WalletIcon, Lock, Users, LogOut, ChevronRight } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { CategoryManagerSheet } from "@/components/category/category-manager-sheet";
import { WalletManagerSheet } from "@/components/wallet/wallet-manager-sheet";
import { PinSettingsSheet } from "@/components/pin/pin-settings-sheet";
import { InviteSheet } from "@/components/household/invite-sheet";
import { signOut } from "@/actions/auth";

type ActiveSheet = "category" | "wallet" | "pin" | "invite" | null;

interface SettingsMenuProps {
  householdId: string;
  userId: string;
  members: { id: string; name: string }[];
}

const MENU_ITEMS: { key: Exclude<ActiveSheet, null>; label: string; icon: typeof Tags }[] = [
  { key: "category", label: "Kelola kategori", icon: Tags },
  { key: "wallet", label: "Kelola dompet", icon: WalletIcon },
  { key: "pin", label: "Kunci PIN", icon: Lock },
  { key: "invite", label: "Undang & keluar household", icon: Users },
];

export function SettingsMenu({ householdId, userId, members }: SettingsMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);

  function openSheet(sheet: Exclude<ActiveSheet, null>) {
    setMenuOpen(false);
    setActiveSheet(sheet);
  }

  return (
    <>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            className="bg-surface-muted"
            aria-label="Menu pengaturan"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </SheetTrigger>
        <SheetContent>
          <SheetTitle className="font-display text-xl font-semibold text-ink">
            Pengaturan
          </SheetTitle>
          <div className="mt-4 space-y-1">
            {MENU_ITEMS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => openSheet(item.key)}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-medium text-ink transition-colors hover:bg-surface-muted"
              >
                <item.icon className="h-4 w-4 text-ink-muted" />
                <span className="flex-1">{item.label}</span>
                <ChevronRight className="h-4 w-4 text-ink-muted" />
              </button>
            ))}
            <form action={signOut}>
              <button
                type="submit"
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-medium text-danger transition-colors hover:bg-expense-soft"
              >
                <LogOut className="h-4 w-4" />
                <span className="flex-1">Keluar akun</span>
              </button>
            </form>
          </div>
        </SheetContent>
      </Sheet>

      <CategoryManagerSheet
        householdId={householdId}
        open={activeSheet === "category"}
        onOpenChange={(o) => setActiveSheet(o ? "category" : null)}
      />
      <WalletManagerSheet
        householdId={householdId}
        userId={userId}
        members={members}
        open={activeSheet === "wallet"}
        onOpenChange={(o) => setActiveSheet(o ? "wallet" : null)}
      />
      <PinSettingsSheet
        open={activeSheet === "pin"}
        onOpenChange={(o) => setActiveSheet(o ? "pin" : null)}
      />
      <InviteSheet
        open={activeSheet === "invite"}
        onOpenChange={(o) => setActiveSheet(o ? "invite" : null)}
      />
    </>
  );
}
