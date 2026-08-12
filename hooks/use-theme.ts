"use client";

import { useLayoutEffect, useState } from "react";
import { getStoredTheme, applyTheme, type ThemeId } from "@/lib/theme/themes";

export function useTheme() {
  const [theme, setThemeState] = useState<ThemeId>(() => getStoredTheme());

  // useLayoutEffect di sini cuma buat sync DOM attribute (external
  // system), BUKAN setState — apply tema ke <html> sebelum paint biar
  // minim "flash" tema default sebelum tema pilihan user ke-apply.
  useLayoutEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function setTheme(next: ThemeId) {
    setThemeState(next);
    applyTheme(next);
  }

  return { theme, setTheme };
}
