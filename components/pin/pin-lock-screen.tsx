"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import { PinPad } from "./pin-pad";
import { verifyPin, markUnlocked } from "@/lib/pin";
import { cn } from "@/lib/utils";

interface PinLockScreenProps {
  onUnlock: () => void;
}

export function PinLockScreen({ onUnlock }: PinLockScreenProps) {
  const [error, setError] = useState(false);
  const [key, setKey] = useState(0); // force remount PinPad biar dot ke-reset setelah salah

  async function handleComplete(pin: string) {
    const valid = await verifyPin(pin);
    if (valid) {
      markUnlocked();
      onUnlock();
    } else {
      setError(true);
      setKey((k) => k + 1);
      setTimeout(() => setError(false), 600);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background px-6">
      <div
        className={cn(
          "mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-sm transition-transform",
          error && "animate-pulse"
        )}
      >
        <Lock className="h-7 w-7" />
      </div>
      <p className="font-display text-2xl font-semibold text-ink">Masukkan PIN</p>
      <p className={cn("mt-1 mb-10 text-sm", error ? "text-danger" : "text-ink-muted")}>
        {error ? "PIN salah, coba lagi." : "Buka Money Tracker kamu"}
      </p>
      <PinPad key={key} onComplete={handleComplete} error={error} />
    </div>
  );
}
