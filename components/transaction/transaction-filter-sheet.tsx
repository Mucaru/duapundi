"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { TransactionFilters, type DateRangeFilter } from "./transaction-filters";
import type { Category, Wallet } from "@/types";

interface TransactionFilterSheetProps {
  categories: Category[];
  wallets: Wallet[];
  members: { id: string; name: string }[];
  currentUserId: string | null;
  dateRange: DateRangeFilter;
  onDateRangeChange: (value: DateRangeFilter) => void;
  categoryId: string | null;
  onCategoryChange: (value: string | null) => void;
  userFilter: string | null;
  onUserFilterChange: (value: string | null) => void;
  walletId: string | null;
  onWalletChange: (value: string | null) => void;
}

const DATE_RANGE_LABELS: Record<DateRangeFilter, string> = {
  this_month: "Bulan ini",
  last_month: "Bulan lalu",
  all: "Semua",
};

export function TransactionFilterSheet(props: TransactionFilterSheetProps) {
  const [open, setOpen] = useState(false);

  const extraActiveCount = [
    props.categoryId !== null,
    props.userFilter !== null,
    props.walletId !== null,
  ].filter(Boolean).length;

  const label =
    extraActiveCount === 0
      ? DATE_RANGE_LABELS[props.dateRange]
      : `${DATE_RANGE_LABELS[props.dateRange]} · ${extraActiveCount} filter lain`;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="mx-6 flex items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-2.5 text-sm font-medium text-ink"
        >
          <SlidersHorizontal className="h-4 w-4 text-ink-muted" />
          {label}
        </button>
      </SheetTrigger>
      <SheetContent>
        <SheetTitle className="font-display text-xl font-semibold text-ink">
          Filter riwayat
        </SheetTitle>
        <div className="mt-4">
          <TransactionFilters {...props} />
        </div>
        <Button className="mt-6 w-full" onClick={() => setOpen(false)}>
          Terapkan
        </Button>
      </SheetContent>
    </Sheet>
  );
}
