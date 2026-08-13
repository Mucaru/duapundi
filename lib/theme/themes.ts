export type ThemeId = "default" | "glass" | "pink" | "natal" | "summer";

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  emoji: string;
  swatch: [string, string, string]; // 3 warna representatif buat preview di picker
  statusBarColor: string; // buat sync <meta name="theme-color"> — status bar HP ikut tema
}

export const THEMES: ThemeDefinition[] = [
  { id: "default", name: "Klasik", emoji: "🌿", swatch: ["#1F5C4E", "#D88C6B", "#F7F9F7"], statusBarColor: "#1F5C4E" },
  { id: "glass", name: "Glass", emoji: "🧊", swatch: ["#3B6FA0", "#EEF1F7", "#FFFFFF"], statusBarColor: "#FFFFFF" },
  { id: "pink", name: "Pink", emoji: "🌸", swatch: ["#D6608C", "#F2A6C4", "#FDF3F6"], statusBarColor: "#D6608C" },
  { id: "natal", name: "Natal", emoji: "🎄", swatch: ["#8C1F28", "#C99A3E", "#FBFAF7"], statusBarColor: "#8C1F28" },
  { id: "summer", name: "Summer", emoji: "☀️", swatch: ["#EC8F2E", "#3AA6A6", "#FFFAF0"], statusBarColor: "#EC8F2E" },
];

const STORAGE_KEY = "money_tracker_theme";

export function getStoredTheme(): ThemeId {
  if (typeof window === "undefined") return "default";
  const stored = localStorage.getItem(STORAGE_KEY);
  return (THEMES.find((t) => t.id === stored)?.id as ThemeId) ?? "default";
}

export function applyTheme(theme: ThemeId): void {
  if (theme === "default") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", theme);
  }
  localStorage.setItem(STORAGE_KEY, theme);

  // Sync <meta name="theme-color"> — ini yang nge-warnain status bar HP
  // pas app di-install sebagai PWA. Next.js cuma set nilai awal statis
  // lewat viewport export, gak otomatis ikut tema yang dipilih user di
  // runtime, jadi kita update manual di sini.
  const color = THEMES.find((t) => t.id === theme)?.statusBarColor ?? "#1F5C4E";
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", color);
}
