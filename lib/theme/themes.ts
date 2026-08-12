export type ThemeId = "default" | "glass" | "pink" | "natal" | "summer";

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  emoji: string;
  swatch: [string, string, string]; // 3 warna representatif buat preview di picker
}

export const THEMES: ThemeDefinition[] = [
  { id: "default", name: "Klasik", emoji: "🌿", swatch: ["#1F5C4E", "#D88C6B", "#F7F9F7"] },
  { id: "glass", name: "Glass", emoji: "🧊", swatch: ["#3B6FA0", "#EEF1F7", "#FFFFFF"] },
  { id: "pink", name: "Pink", emoji: "🌸", swatch: ["#D6608C", "#F2A6C4", "#FDF3F6"] },
  { id: "natal", name: "Natal", emoji: "🎄", swatch: ["#8C1F28", "#C99A3E", "#FBFAF7"] },
  { id: "summer", name: "Summer", emoji: "☀️", swatch: ["#EC8F2E", "#3AA6A6", "#FFFAF0"] },
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
}
