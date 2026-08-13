"use client";

import type { ThemeId } from "@/lib/theme/themes";

interface ThemeMascotProps {
  theme: ThemeId;
  className?: string;
}

/**
 * Karakter kecil per tema — sentuhan personal biar app gak berasa
 * korporat/monoton. Ditaruh di pojok BalanceCard, semi-transparan &
 * gak ganggu keterbacaan angka.
 */
export function ThemeMascot({ theme, className }: ThemeMascotProps) {
  const common = "pointer-events-none select-none";
  const cls = className ? `${common} ${className}` : common;

  switch (theme) {
    case "summer":
      return (
        <svg viewBox="0 0 120 120" className={cls} aria-hidden="true">
          {/* matahari */}
          <circle cx="90" cy="28" r="16" fill="#FFD873" opacity="0.9" />
          {/* payung pantai */}
          <path d="M40 55 L40 100" stroke="#fff" strokeWidth="3" opacity="0.6" />
          <path
            d="M10 55 Q40 20 70 55 Z"
            fill="#3AA6A6"
            opacity="0.85"
          />
          <path d="M10 55 Q40 20 70 55" fill="none" stroke="#fff" strokeWidth="2" opacity="0.4" />
          {/* orang santai */}
          <ellipse cx="55" cy="98" rx="22" ry="5" fill="#fff" opacity="0.25" />
          <circle cx="30" cy="88" r="6" fill="#F4C89A" />
          <path d="M20 92 Q35 100 50 94" stroke="#fff" strokeWidth="6" strokeLinecap="round" opacity="0.85" />
        </svg>
      );
    case "natal":
      return (
        <svg viewBox="0 0 120 120" className={cls} aria-hidden="true">
          {/* pohon natal kecil */}
          <path d="M60 20 L78 55 L66 55 L82 82 L38 82 L54 55 L42 55 Z" fill="#2f6b45" opacity="0.85" />
          <rect x="54" y="82" width="12" height="12" rx="2" fill="#6e5a52" opacity="0.7" />
          <circle cx="60" cy="20" r="5" fill="#C99A3E" />
          <circle cx="50" cy="60" r="3" fill="#C99A3E" opacity="0.9" />
          <circle cx="70" cy="65" r="3" fill="#fff" opacity="0.9" />
          <circle cx="60" cy="75" r="3" fill="#C99A3E" opacity="0.9" />
          {/* salju jatuh */}
          <circle cx="20" cy="30" r="2.5" fill="#fff" opacity="0.7" />
          <circle cx="95" cy="45" r="2" fill="#fff" opacity="0.6" />
          <circle cx="30" cy="70" r="2" fill="#fff" opacity="0.5" />
        </svg>
      );
    case "pink":
      return (
        <svg viewBox="0 0 120 120" className={cls} aria-hidden="true">
          {/* ranting sakura sederhana */}
          <path d="M15 100 Q45 60 90 25" stroke="#B57C93" strokeWidth="3" fill="none" opacity="0.6" />
          {[
            [40, 78],
            [55, 62],
            [68, 48],
            [80, 35],
          ].map(([cx, cy], i) => (
            <g key={i}>
              <circle cx={cx} cy={cy} r="7" fill="#F2A6C4" opacity="0.9" />
              <circle cx={cx - 5} cy={cy - 3} r="5" fill="#F7C4D8" opacity="0.85" />
              <circle cx={cx + 5} cy={cy - 2} r="5" fill="#F7C4D8" opacity="0.85" />
            </g>
          ))}
        </svg>
      );
    case "glass":
      return (
        <svg viewBox="0 0 120 120" className={cls} aria-hidden="true">
          {/* kristal/es mengambang */}
          <polygon points="60,15 85,45 70,95 50,95 35,45" fill="rgba(255,255,255,0.35)" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" />
          <polygon points="60,15 85,45 60,50" fill="rgba(255,255,255,0.5)" />
          <polygon points="60,15 35,45 60,50" fill="rgba(255,255,255,0.25)" />
          <circle cx="95" cy="30" r="3" fill="rgba(255,255,255,0.7)" />
          <circle cx="25" cy="60" r="2.5" fill="rgba(255,255,255,0.6)" />
          <circle cx="90" cy="75" r="2" fill="rgba(255,255,255,0.5)" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 120 120" className={cls} aria-hidden="true">
          {/* karakter kecambah/sprout, senyum kecil */}
          <path d="M60 100 L60 60" stroke="#2E7D5B" strokeWidth="4" strokeLinecap="round" opacity="0.9" />
          <path
            d="M60 62 Q35 55 32 30 Q58 32 60 62"
            fill="#3E9A6E"
            opacity="0.9"
          />
          <path
            d="M60 55 Q85 48 88 25 Q62 27 60 55"
            fill="#4FB57F"
            opacity="0.9"
          />
          <circle cx="60" cy="102" r="10" fill="#D88C6B" opacity="0.9" />
          <circle cx="57" cy="100" r="1.5" fill="#2A2420" />
          <circle cx="63" cy="100" r="1.5" fill="#2A2420" />
          <path d="M56 104 Q60 107 64 104" stroke="#2A2420" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        </svg>
      );
  }
}
