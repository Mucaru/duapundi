import type { Transaction, Category, Wallet } from "@/types";

/**
 * Escape 1 field CSV sesuai RFC 4180: kalau field mengandung koma,
 * quote, atau newline, bungkus pakai double-quote dan double-kan
 * quote internal-nya. Wajib buat "Catatan" transaksi yang user tulis
 * bebas — bisa aja ada koma di situ ("beli baju, sepatu, tas").
 */
function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

interface CsvContext {
  categories: Category[];
  wallets: Wallet[];
  members: { id: string; name: string }[];
  currentUserId: string | null;
}

const HEADERS = [
  "Tanggal",
  "Tipe",
  "Kategori",
  "Dompet",
  "Nominal",
  "Catatan",
  "Dicatat oleh",
];

/**
 * Bangun CSV dari list transaksi yang UDAH DIFILTER (dari
 * listTransactions() di lib/db/transactions.ts). Fungsi ini murni
 * transformasi data lokal — gak ada query tambahan ke Dexie atau
 * Supabase di sini sama sekali, semua lookup (nama kategori/dompet/
 * member) pakai data yang udah di-load di memory.
 */
export function transactionsToCsv(
  transactions: Transaction[],
  ctx: CsvContext
): string {
  const rows = transactions.map((tx) => {
    const category = ctx.categories.find((c) => c.id === tx.category_id);
    const wallet = ctx.wallets.find((w) => w.id === tx.wallet_id);
    const memberName =
      tx.user_id === ctx.currentUserId
        ? "Kamu"
        : (ctx.members.find((m) => m.id === tx.user_id)?.name ?? "?");

    return [
      tx.date,
      tx.type === "income" ? "Pemasukan" : "Pengeluaran",
      category?.name ?? "",
      wallet?.name ?? "",
      String(tx.amount),
      tx.note ?? "",
      memberName,
    ];
  });

  const lines = [HEADERS, ...rows].map((row) =>
    row.map(escapeCsvField).join(",")
  );

  // \uFEFF (BOM) di depan — biar Excel (terutama versi Windows) baca
  // encoding UTF-8-nya bener, gak keliatan aneh pas ada karakter non-ASCII.
  return "\uFEFF" + lines.join("\r\n");
}

/** Trigger download file lewat Blob + anchor sementara. Client-side murni. */
export function downloadCsv(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
