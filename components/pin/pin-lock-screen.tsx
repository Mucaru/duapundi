"use client";

import { useState } from "react";
import { PinPad } from "./pin-pad";
import { verifyPin, markUnlocked } from "@/lib/pin";

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
      <p className="font-display text-2xl font-semibold text-ink">Masukkan PIN</p>
      <p className="mt-1 mb-8 text-sm text-ink-muted">
        {error ? "PIN salah, coba lagi." : "Buka Money Tracker kamu"}
      </p>
      <PinPad key={key} onComplete={handleComplete} error={error} />
    </div>
  );
}
