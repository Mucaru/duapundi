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
 * Bangun CSV dari list transaksi yang UDAH DIFILTER.
 * Menambahkan baris total pemasukan, pengeluaran, dan saldo akhir 
 * di bagian bawah agar laporan terlihat rapi dan profesional saat dibuka di Excel.
 */
export function transactionsToCsv(
  transactions: Transaction[],
  ctx: CsvContext
): string {
  let totalIncome = 0;
  let totalExpense = 0;

  const rows = transactions.map((tx) => {
    const category = ctx.categories.find((c) => c.id === tx.category_id);
    const wallet = ctx.wallets.find((w) => w.id === tx.wallet_id);
    const memberName =
      tx.user_id === ctx.currentUserId
        ? "Kamu"
        : (ctx.members.find((m) => m.id === tx.user_id)?.name ?? "?");

    // Kalkulasi akumulasi total
    if (tx.type === "income") {
      totalIncome += tx.amount;
    } else {
      // Asumsi tipe selain income adalah pengeluaran (expense)
      totalExpense += tx.amount;
    }

    return [
      tx.date,
      tx.type === "income" ? "Pemasukan" : "Pengeluaran",
      category?.name ?? "-", // Pakai "-" jika kosong agar cell di Excel tidak benar-benar blank
      wallet?.name ?? "-",
      String(tx.amount),
      tx.note ?? "",
      memberName,
    ];
  });

  const finalBalance = totalIncome - totalExpense;

  // Membuat baris pemisah (kosong) agar rapi secara visual
  const separatorRow = ["", "", "", "", "", "", ""];

  // Membuat baris rekap total. 
  // Label disejajarkan di kolom ke-4 (Dompet) dan Nilai di kolom ke-5 (Nominal)
  const incomeRow = ["", "", "", "Total Pemasukan", String(totalIncome), "", ""];
  const expenseRow = ["", "", "", "Total Pengeluaran", String(totalExpense), "", ""];
  const balanceRow = ["", "", "", "Saldo Akhir", String(finalBalance), "", ""];

  // Gabungkan Headers, Data Transaksi, Pemisah, dan Rekap
  const allRows = [
    HEADERS,
    ...rows,
    separatorRow,
    incomeRow,
    expenseRow,
    balanceRow
  ];

  const lines = allRows.map((row) =>
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