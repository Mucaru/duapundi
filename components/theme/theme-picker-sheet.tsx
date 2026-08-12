"use client";

import { Check } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { THEMES } from "@/lib/theme/themes";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

interface ThemePickerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ThemePickerSheet({ open, onOpenChange }: ThemePickerSheetProps) {
  const { theme, setTheme } = useTheme();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetTitle className="font-display text-xl font-semibold text-ink">
          Pilih tema
        </SheetTitle>
        <p className="mt-1 text-sm text-ink-muted">
          Ganti tampilan app kapan aja, gak ngaruh ke data kamu sama sekali.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-3">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTheme(t.id)}
              className={cn(
                "relative overflow-hidden rounded-2xl border-2 p-4 text-left transition-all",
                theme === t.id ? "border-primary" : "border-border"
              )}
              style={{ backgroundColor: t.swatch[2] }}
            >
              {theme === t.id && (
                <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
                  <Check className="h-3 w-3" />
                </span>
              )}
              <span className="text-lg">{t.emoji}</span>
              <p className="mt-2 text-sm font-semibold" style={{ color: t.swatch[0] }}>
                {t.name}
              </p>
              <div className="mt-2 flex gap-1.5">
                <span
                  className="h-4 w-4 rounded-full border border-black/10"
                  style={{ backgroundColor: t.swatch[0] }}
                />
                <span
                  className="h-4 w-4 rounded-full border border-black/10"
                  style={{ backgroundColor: t.swatch[1] }}
                />
              </div>
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
