"use client";

import { useHousehold } from "@/hooks/use-household";
import { useCurrentUser } from "@/hooks/use-current-user";
import { BalanceCard } from "@/components/summary/balance-card";
import { QuickAddSheet } from "@/components/transaction/quick-add-sheet";
import { TransactionList } from "@/components/transaction/transaction-list";
import { SyncStatusBadge } from "@/components/layout/sync-status-badge";
import { SyncProvider } from "@/components/providers/sync-provider";
import { InviteSheet } from "@/components/household/invite-sheet";
import { Button } from "@/components/ui/button";
import { signOut } from "@/actions/auth";

interface HomeClientProps {
  fallbackName: string;
}

export function HomeClient({ fallbackName }: HomeClientProps) {
  const { ready, bootstrapError, household, wallets, categories } = useHousehold();
  const { userId } = useCurrentUser();

  if (!ready) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background">
        <p className="text-sm text-ink-muted">Memuat...</p>
      </main>
    );
  }

  if (bootstrapError && !household) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-3 bg-background px-6 text-center">
        <p className="text-sm text-ink-muted">{bootstrapError}</p>
      </main>
    );
  }

  if (!household) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background px-6 text-center">
        <p className="text-sm text-ink-muted">
          Household tidak ditemukan. Coba muat ulang saat online.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-svh bg-background pb-6">
      <SyncProvider householdId={household.id} />
      <div className="flex items-center justify-between px-6 pt-6">
        <p className="font-display text-lg font-semibold text-ink">
          {household.name}
        </p>
        <div className="flex items-center gap-2">
          <InviteSheet />
          <SyncStatusBadge />
          <form action={signOut}>
            <Button variant="ghost" size="sm" type="submit">
              Keluar
            </Button>
          </form>
        </div>
      </div>

      <BalanceCard householdId={household.id} greetingName={fallbackName} />

      <div className="mt-6">
        <TransactionList householdId={household.id} categories={categories} />
      </div>

      {userId && (
        <QuickAddSheet
          categories={categories}
          wallets={wallets}
          householdId={household.id}
          userId={userId}
        />
      )}
    </main>
  );
}
