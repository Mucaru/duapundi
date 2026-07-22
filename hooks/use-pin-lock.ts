"use client";

import { useEffect, useState } from "react";
import { hasPinSet, isUnlockedThisSession, markUnlocked, UNLOCKED_SESSION_KEY } from "@/lib/pin";

export function usePinLock() {
  const [locked, setLocked] = useState<boolean | null>(null); // null = belum dicek (hindari flash)

  useEffect(() => {
    function evaluate() {
      if (!hasPinSet()) {
        setLocked(false);
        return;
      }
      setLocked(!isUnlockedThisSession());
    }

    evaluate();

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        // Hapus status unlock begitu app disembunyikan (pindah tab/app lain,
        // minimize) — supaya PIN diminta lagi tiap kali di-resume, sesuai
        // rekomendasi self-critique ("muncul tiap kali app dibuka/di-resume").
        sessionStorage.removeItem(UNLOCKED_SESSION_KEY);
      } else {
        evaluate();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  return {
    locked: locked ?? false,
    ready: locked !== null,
    unlock: () => {
      markUnlocked();
      setLocked(false);
    },
  };
}
