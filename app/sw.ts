/// <reference lib="webworker" />
import { defaultCache } from "@serwist/next/worker";
import { Serwist } from "serwist";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const self: ServiceWorkerGlobalScope &
  typeof globalThis & {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  } & SerwistGlobalConfig;

/**
 * App shell caching: precache semua asset build (JS/CSS/font) supaya
 * app bisa dibuka instan walau device offline total dari cold start
 * (bukan cuma "sudah pernah dibuka sekali").
 *
 * API call ke Supabase SENGAJA tidak di-cache di sini — itu tanggung
 * jawab sync engine (lib/sync/), bukan service worker. Service worker
 * cuma bertanggung jawab atas app shell (HTML/JS/CSS/font/icon).
 */
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
