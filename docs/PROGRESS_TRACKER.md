# Progress Tracker — Money Tracker

Dokumen ini nyatet **seluruh perjalanan** project ini dari nol, biar gampang di-refer balik kapanpun (terutama kalau lanjut kerja bareng AI lain atau lupa konteks). Update terus tiap ada progress baru.

**Status saat ini:** ✅ Live di production — [duapundi.vercel.app](https://duapundi.vercel.app), repo di [github.com/Mucaru/duapundi](https://github.com/Mucaru/duapundi)

---

## 📐 Fase 0 — Perencanaan Arsitektur

Sebelum coding sama sekali, disepakati dulu:

- **Strategi sync:** local-first (Dexie/IndexedDB jadi source of truth UI), outbox pattern (`sync_queue`) buat push ke Supabase di background
- **Conflict resolution:** Last-Write-Wins berbasis `updated_at` **server-authoritative** (bukan jam client) + tombstone soft-delete (bukan hard delete)
- **Kenapa bukan CRDT/manual-merge:** overkill buat 2 user, append-only case (kasus paling sering) gak butuh itu
- **Desain visual:** clean-trustworthy base + sentuhan warm personal. Font: Fraunces (display) + Plus Jakarta Sans (body)

---

## 🏗️ Fase 1 — Setup Project (Tahap 1-3)

- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- Design tokens custom (`app/globals.css`)
- Dexie schema (`lib/db/schema.ts`) — tabel `users`, `households`, `wallets`, `categories`, `transactions`, `budgets`, `sync_queue`
- Supabase schema + RLS (`supabase/migrations/0001_init.sql`) — household-scoped access
- Serwist PWA (service worker, app shell precaching)
- Icon PWA custom (wallet + koin, brand color) via SVG → rsvg-convert

**Isu yang ketemu & fixed:**
- shadcn CLI gak bisa akses `ui.shadcn.com` di sandbox → komponen dibikin manual
- `tailwindcss-animate` incompatible sama Tailwind v4 → diganti CSS animation native
- Next.js 16 rename `middleware.ts` → `proxy.ts`

---

## 🔐 Fase 2 — Auth + Household (Tahap 4)

- Sign up/in via Supabase Auth (server actions)
- Household create/join lewat `SECURITY DEFINER` RPC (invite code, max 2 anggota)
- Auto-seed kategori & wallet default pas household dibuat

**Bug ditemukan & fixed:**
- 🐛 **useActionState shared antar 2 action** — form "Buat household" diam-diam manggil action "Join household" karena 1 hook `useActionState` dipakai gantian buat 2 fungsi beda. Fix: pisah hook per action. (Kejadian juga di form login/signup dan onboarding.)
- 🐛 Supabase email rate limit kena pas testing berkali-kali — bukan bug, solusi: matiin "Confirm email" pas dev
- 🐛 Error signup terlalu generik, nyusahin debug → dibedah jadi spesifik per error code

---

## 💾 Fase 3 — Local CRUD (Tahap 5.2)

- Outbox pattern: tiap mutation (`createTransactionLocal`, dst) nulis ke Dexie **dan** `sync_queue` dalam 1 transaction atomic
- Quick-add flow: kategori favorit → numpad besar → simpan (target < 10 detik)
- Transaction list reaktif (`useLiveQuery`)

**Bug ditemukan & fixed:**
- 🐛 Sheet gak punya max-height/scroll — konten panjang (numpad) ngedorong tombol close keluar viewport di HP

---

## 🔄 Fase 4 — Sync Engine (Tahap 5.3)

- Push: proses `sync_queue` FIFO, retry + exponential backoff
- Pull: Supabase Realtime subscription + reconcile fetch
- Badge status sync (online/offline/pending/syncing)

**Bug ditemukan & fixed:**
- 🐛 **CRITICAL:** ID transaksi pakai `nanoid()`, padahal kolom Postgres `uuid` — insert SELALU ditolak server, gagal SENYAP. Fix: `crypto.randomUUID()`.
- 🐛 Badge bilang "Menyinkronkan..." padahal gak ada proses jalan — wording gak jujur, di-fix

---

## 🏷️ Fase 5 — Kategori, Filter, PWA Polish (Tahap 5.4-5.6)

- Kategori custom (CRUD, favorit, warna dari palette terkurasi)
- Riwayat + filter (tanggal, kategori)
- Icon PWA real, manifest, apple-touch-icon

---

## 🚀 v1.1 — P0 dari Self-Critique

1. **Edit & hapus transaksi** — fungsi backend udah ada tapi gak ada UI yang manggil
2. **Confirm dialog** — aksi destruktif sebelumnya langsung eksekusi tanpa konfirmasi
3. **PIN lock** — app-level, hash SHA-256, minta ulang tiap app di-resume. Eksplisit: gerbang tampilan, BUKAN enkripsi data
4. **Keluar dari household** — RPC `leave_household()`

**Bug ditemukan & fixed:**
- 🐛 README ada backslash nyangkut di depan tiap backtick — semua code block rusak di GitHub
- 🐛 Login offline nampilin "email/password salah" padahal penyebabnya network gagal total

---

## 🔧 v1.2 — Fix Teknis + Fitur Besar

### Bagian 1: Fix Teknis (post-mortem v1.1)
- Update-operation graceful orphan handling
- Multi-tab leader lock (Web Locks API)
- Sync Log sheet — observability

### Bagian 2: Multi-Wallet
- CRUD wallet, privat (misal Mucaru Store) vs shared
- Wallet picker di quick-add, filter riwayat by wallet

### Bagian 3: Visibilitas Per-User
- Badge "oleh Kamu"/"oleh [nama]", filter by orang, breakdown pengeluaran per orang

### 🔥 Bug Kritis: Data "Hidup Lagi" (Tombstone Gak Propagate)
**Kejadian:** transaksi yang dihapus manual dari Supabase Dashboard muncul lagi di device lain.

**Root cause:** delete yang gagal (row target udah gak ada di server) cuma di-soft-delete **lokal doang**.

**Fix:** insert ulang row itu sebagai tombstone (payload full) kalau update/delete gagal karena row gak ketemu (`PGRST116`).

### 🔍 Audit Sistematis
1. **Reconcile checkpoint** bisa hilang data permanen kalau network kepotong. Fixed.
2. **"At-least-once delivery" bug** — insert sukses tapi response ilang → retry ketabrak unique constraint → stuck permanen. Fixed.
3. **Exponential backoff baseline salah** (`created_at` bukan percobaan terakhir). Fixed via field `last_attempted_at`.

**Tool baru:** Integrity Check — bandingin data lokal vs server.

### 🎨 Redesign UI (Konsolidasi)
- Header 6 elemen → 3 (nama household + Settings Menu + badge sync)
- Filter 4 baris chip → 1 tombol ringkasan
- Balance breakdown collapsible
- **Pagination** — 30 transaksi per halaman

**Bug ditemukan & fixed:**
- 🐛 Filter kategori masih nampilin kategori terhapus (`useHousehold` gak filter `deleted_at`)
- 🐛 Auth 57 detik pas refresh token invalid — fixed, langsung clear session

### 💰 Budget per Kategori
- `lib/db/budgets.ts` (outbox pattern), sync engine extended buat entity `budget`
- `BudgetManagerSheet` — set limit per kategori/bulan, progress bar
- `BudgetWarningBanner` — muncul otomatis kalau ada kategori ≥80% limit

**Gap ditemukan sebelum fitur dibangun:**
- 🐛 Tabel `budgets` dari awal gak punya `deleted_at` & trigger `updated_at` — kelewat pas migration 0001. Fixed via `0008_budgets_deleted_at.sql` SEBELUM ada data beneran (untung ketauan lebih dulu).

**Bug ditemukan & fixed setelah dipakai beneran:**
- 🐛 **"unknown_error" nutupin pesan error asli** — `PostgrestError` dari Supabase itu plain object `{message, code, ...}`, BUKAN instance dari class `Error` JS. Cek `err instanceof Error` gagal buat kasus ini, jatuh ke pesan generik yang gak berguna buat debugging. Fixed: extract `.message` dari object apapun yang punya field itu, gak cuma dari instance Error.
- 🐛 **Budget stuck gagal sync** — 2 kemungkinan akar masalah dibenerin: (1) UI ngizinin `limit_amount = 0` ke-submit (validasi cuma cek non-empty string, `"0"` lolos), padahal constraint Postgres nolak nilai itu selamanya; (2) unique constraint budget itu di kombinasi `(household_id, category_id, month)`, BUKAN di `id` — kalau 2 device nyaris bareng bikin budget kategori+bulan yang sama, insert kedua ketabrak constraint dengan row conflict yang id-nya BEDA, dan logic 23505 kita sebelumnya cuma nyari by `id` jadi gak ketemu apa-apa & nyangkut. Fixed: fallback lookup by composite key, adopsi row server yang asli kalau ketemu.
- 🐛 **Wallet "2 di server, 1 di lokal"** — root cause: `reconcileAll` cuma narik data yang `updated_at`-nya lebih baru dari checkpoint terakhir (biar efisien); row yang entah kenapa kelewat (updated_at-nya lebih lama dari checkpoint yang udah kadung maju) gak akan PERNAH ketarik lagi lewat reconcile biasa manapun. Fixed: `runIntegrityCheck` sekarang **self-healing** — begitu ketemu row yang cuma ada di server, langsung fetch & merge saat itu juga, gak peduli checkpoint sama sekali.

**Polish UX (BudgetManagerSheet):**
- Kartu ringkasan "Total budget bulan ini" di atas (total limit vs total terpakai semua kategori)
- Kategori diurutin: yang udah ada limit & paling mendesak persentasenya duluan, yang belum ada limit di bawah
- Label bulan format Indonesia ("Agustus 2026", bukan "2026-08")
- Nampilin "Sisa Rp X" (bukan cuma rasio terpakai/limit)
- Tombol back (bukan cuma tutup sheet) pas lagi di form edit limit

---

## 🌐 Deploy

- GitHub: [github.com/Mucaru/duapundi](https://github.com/Mucaru/duapundi)
- Vercel: **duapundi.vercel.app**

---

## 📋 Backlog Belum Dikerjain

- [x] ~~Budget per kategori + indikator mendekati limit~~ ✅
- [ ] Export CSV
- [ ] Unit test sync engine
- [ ] Grafik/insight (Recharts udah ke-install, belum dipakai)
- [ ] Shared expense / split bill
- [ ] Recurring transaction
- [ ] Foto struk
- [ ] Reminder harian
- [ ] Splash screen iOS custom
- [ ] RLS edge case: user keluar household tapi masih ada pending sync_queue item

---

## 🧠 Prinsip & Pelajaran Penting (biar gak keulang)

1. **`useActionState` gak boleh di-share antar action berbeda** yang di-toggle dinamis — pisah hook per action.
2. **ID ke kolom Postgres `uuid` HARUS `crypto.randomUUID()`**, bukan `nanoid()`.
3. **Jangan pernah edit/hapus data langsung dari Supabase Dashboard** — sistem sync bergantung penuh pada tombstone dari app.
4. **Checkpoint reconcile harus pakai timestamp server**, jangan maju kalau ada request gagal.
5. **Operasi network yang di-retry harus idempotent** — unique violation = anggap sukses, bukan stuck selamanya.
6. **`useEffect` + `setState` buat reset state pas prop berubah itu anti-pattern** — pakai "derived state saat render".
7. **Tiap tabel baru HARUS punya `deleted_at` + trigger `updated_at` dari awal** — kelupaan di `budgets`, untung ketauan sebelum ada data beneran.
8. **`PostgrestError` dari Supabase BUKAN instance dari `Error` JS** — jangan cek `err instanceof Error` doang buat extract pesan, atau bakal jatuh ke "unknown_error" generik dan kehilangan detail yang sebenernya paling penting.
9. **Unique constraint yang bukan di kolom `id`** (misal budget: `household_id+category_id+month`) butuh handling 23505 yang beda — lookup by `id` gak bakal nemu row yang conflict, karena row conflict itu punya `id` yang beda. Perlu fallback lookup by composite key.
10. **Reconcile berbasis checkpoint (`updated_at > lastSync`) punya blind spot**: row yang timestamp-nya lebih lama dari checkpoint yang udah kadung maju gak akan PERNAH ketarik lagi. Butuh mekanisme "full check" terpisah yang gak peduli checkpoint (integrity check) buat jaga-jaga.
