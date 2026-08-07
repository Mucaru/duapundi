"use client";

import { useState } from "react";
import { useHousehold } from "@/hooks/use-household";
import { useCurrentUser } from "@/hooks/use-current-user";
import { BalanceCard } from "@/components/summary/balance-card";
import { QuickAddSheet } from "@/components/transaction/quick-add-sheet";
import { TransactionList } from "@/components/transaction/transaction-list";
import { TransactionDetailSheet } from "@/components/transaction/transaction-detail-sheet";
import type { Transaction } from "@/types";
import {
  dateRangeToBounds,
  type DateRangeFilter,
} from "@/components/transaction/transaction-filters";
import { TransactionFilterSheet } from "@/components/transaction/transaction-filter-sheet";
import { SyncStatusBadge } from "@/components/layout/sync-status-badge";
import { SyncProvider } from "@/components/providers/sync-provider";
import { SettingsMenu } from "@/components/layout/settings-menu";
import { BudgetManagerSheet } from "@/components/budget/budget-manager-sheet";
import { BudgetWarningBanner } from "@/components/budget/budget-warning-banner";
import { PinLockScreen } from "@/components/pin/pin-lock-screen";
import { usePinLock } from "@/hooks/use-pin-lock";

interface HomeClientProps {
  fallbackName: string;
}

export function HomeClient({ fallbackName }: HomeClientProps) {
  const { ready, bootstrapError, household, wallets, categories, members } = useHousehold();
  const { userId } = useCurrentUser();
  const { locked, unlock, ready: pinReady } = usePinLock();
  const [dateRange, setDateRange] = useState<DateRangeFilter>("this_month");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [userFilter, setUserFilter] = useState<string | null>(null);
  const [walletFilter, setWalletFilter] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [budgetSheetOpen, setBudgetSheetOpen] = useState(false);

  if (!pinReady) {
    return <main className="min-h-svh bg-background" />;
  }

  if (locked) {
    return <PinLockScreen onUnlock={unlock} />;
  }

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
      <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-3 px-6 pt-6">
        <p className="font-display text-lg font-semibold text-ink">
          {household.name}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {userId && (
            <SettingsMenu
              householdId={household.id}
              userId={userId}
              members={members}
              onOpenBudget={() => setBudgetSheetOpen(true)}
            />
          )}
          <SyncStatusBadge householdId={household.id} />
        </div>
      </div>

      <BalanceCard
        householdId={household.id}
        greetingName={fallbackName}
        members={members}
        currentUserId={userId}
      />

      <div className="mt-4">
        <BudgetWarningBanner
          householdId={household.id}
          onOpenBudget={() => setBudgetSheetOpen(true)}
        />
      </div>

      <div className="mt-4 space-y-4">
        <TransactionFilterSheet
          categories={categories}
          wallets={wallets.filter((w) => !w.is_archived)}
          members={members}
          currentUserId={userId}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          categoryId={categoryFilter}
          onCategoryChange={setCategoryFilter}
          userFilter={userFilter}
          onUserFilterChange={setUserFilter}
          walletId={walletFilter}
          onWalletChange={setWalletFilter}
        />
        <TransactionList
          householdId={household.id}
          categories={categories}
          wallets={wallets}
          members={members}
          currentUserId={userId}
          dateFrom={dateRangeToBounds(dateRange).from}
          dateTo={dateRangeToBounds(dateRange).to}
          categoryId={categoryFilter}
          userFilter={userFilter}
          walletId={walletFilter}
          onSelectTransaction={setSelectedTransaction}
        />
      </div>

      {userId && (
        <TransactionDetailSheet
          transaction={selectedTransaction}
          categories={categories}
          userId={userId}
          onClose={() => setSelectedTransaction(null)}
        />
      )}

      <BudgetManagerSheet
        householdId={household.id}
        open={budgetSheetOpen}
        onOpenChange={setBudgetSheetOpen}
      />

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
