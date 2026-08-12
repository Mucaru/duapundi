"use client";

import { useState } from "react";
import { SlidersHorizontal, Download } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  TransactionFilters,
  dateRangeToBounds,
  type DateRangeFilter,
} from "./transaction-filters";
import { listTransactions } from "@/lib/db/transactions";
import { transactionsToCsv, downloadCsv } from "@/lib/export/csv";
import type { Category, Wallet } from "@/types";

interface TransactionFilterSheetProps {
  householdId: string;
  categories: Category[];
  wallets: Wallet[];
  allWallets: Wallet[]; // termasuk yang diarsipkan — khusus lookup nama di CSV export
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
  const [exporting, setExporting] = useState(false);

  const extraActiveCount = [
    props.categoryId !== null,
    props.userFilter !== null,
    props.walletId !== null,
  ].filter(Boolean).length;

  const label =
    extraActiveCount === 0
      ? DATE_RANGE_LABELS[props.dateRange]
      : `${DATE_RANGE_LABELS[props.dateRange]} · ${extraActiveCount} filter lain`;

  async function handleExport() {
    if (exporting) return;
    setExporting(true);
    try {
      // Export "flexible" — ngikutin persis filter yang lagi aktif di
      // layar (tanggal, kategori, orang, dompet), bukan selalu semua
      // data. Query-nya 100% dari Dexie lokal (listTransactions), NOL
      // hit ke Supabase — efisien dan gak ada resiko apapun ke database
      // server, seberapa sering pun tombol ini dipencet.
      const bounds = dateRangeToBounds(props.dateRange);
      const transactions = await listTransactions(props.householdId, {
        from: bounds.from,
        to: bounds.to,
        categoryId: props.categoryId,
        userId: props.userFilter,
        walletId: props.walletId,
      });

      const csv = transactionsToCsv(transactions, {
        categories: props.categories,
        wallets: props.allWallets,
        members: props.members,
        currentUserId: props.currentUserId,
      });

      const rangeLabel = DATE_RANGE_LABELS[props.dateRange]
        .toLowerCase()
        .replace(/\s+/g, "-");
      const today = new Date().toISOString().slice(0, 10);
      downloadCsv(`money-tracker-${rangeLabel}-${today}.csv`, csv);
    } finally {
      setExporting(false);
    }
  }

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
        <div className="mt-6 flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleExport}
            disabled={exporting}
          >
            <Download className="h-4 w-4" />
            {exporting ? "Nyiapin..." : "Export CSV"}
          </Button>
          <Button className="flex-1" onClick={() => setOpen(false)}>
            Terapkan
          </Button>
        </div>
        <p className="mt-2 text-center text-xs text-ink-muted">
          Export ngikutin filter yang lagi aktif di atas
        </p>
      </SheetContent>
    </Sheet>
  );
}
