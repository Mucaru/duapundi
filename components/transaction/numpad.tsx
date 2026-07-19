"use client";

import { Delete } from "lucide-react";
import { formatIDR } from "@/lib/utils";

interface NumpadProps {
  value: string; // digit string mentah, misal "15000"
  onChange: (value: string) => void;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "000", "0", "del"];

export function Numpad({ value, onChange }: NumpadProps) {
  const amount = value ? parseInt(value, 10) : 0;

  function press(key: string) {
    if (key === "del") {
      onChange(value.slice(0, -1));
      return;
    }
    // Batasi 10 digit (cukup untuk 9,999,999,999 — lebih dari cukup untuk personal finance)
    if (value.replace(/^0+/, "").length >= 10) return;
    onChange((value + key).replace(/^0+(?=\d)/, ""));
  }

  return (
    <div>
      <p className="mb-4 text-center font-display text-4xl font-semibold tabular-nums text-ink">
        {formatIDR(amount)}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {KEYS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => press(key)}
            className="flex h-16 items-center justify-center rounded-2xl bg-surface-muted text-xl font-semibold text-ink transition-colors active:bg-border"
            aria-label={key === "del" ? "Hapus digit terakhir" : `Angka ${key}`}
          >
            {key === "del" ? <Delete className="h-5 w-5" /> : key}
          </button>
        ))}
      </div>
    </div>
  );
}
