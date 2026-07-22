"use client";

import { useState } from "react";
import { Delete } from "lucide-react";
import { cn } from "@/lib/utils";

interface PinPadProps {
  length?: number;
  onComplete: (pin: string) => void;
  error?: boolean;
}

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "del"];

export function PinPad({ length = 6, onComplete, error }: PinPadProps) {
  const [value, setValue] = useState("");

  function press(key: string) {
    if (key === "del") {
      setValue((v) => v.slice(0, -1));
      return;
    }
    if (!key || value.length >= length) return;
    const next = value + key;
    setValue(next);
    if (next.length === length) {
      onComplete(next);
      setValue("");
    }
  }

  return (
    <div>
      <div className={cn("mb-8 flex justify-center gap-3", error && "animate-pulse")}>
        {Array.from({ length }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-3.5 w-3.5 rounded-full border-2",
              i < value.length ? "border-primary bg-primary" : "border-border bg-transparent",
              error && "border-danger"
            )}
          />
        ))}
      </div>
      <div className="mx-auto grid max-w-xs grid-cols-3 gap-3">
        {KEYS.map((key, i) => (
          <button
            key={i}
            type="button"
            disabled={!key}
            onClick={() => press(key)}
            className={cn(
              "flex h-16 items-center justify-center rounded-2xl text-xl font-semibold text-ink transition-colors",
              key ? "bg-surface-muted active:bg-border" : "invisible"
            )}
          >
            {key === "del" ? <Delete className="h-5 w-5" /> : key}
          </button>
        ))}
      </div>
    </div>
  );
}
