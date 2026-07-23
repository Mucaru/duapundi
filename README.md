# Money Tracker 💰🌱

Aplikasi pencatatan keuangan harian, **offline-first**, dipakai berdua sama pasangan. Bisa dibuka kapan aja tanpa internet — data tersimpan lokal duluan, sync otomatis begitu online lagi.

Dibangun sebagai proyek personal (bukan demo/challenge) — dipakai beneran sehari-hari.

## ✨ Fitur

- Catat transaksi super cepat (target < 10 detik): pilih kategori → numpad besar → simpan
- Edit & hapus transaksi (dengan konfirmasi sebelum aksi destruktif)
- Offline-first penuh — semua fitur inti jalan tanpa internet, sync otomatis di background
- 2 user per household (kamu & pasangan), invite lewat kode undangan, bisa keluar household kapan aja
- Kategori custom (income/expense), favorit buat quick-add, bisa dihapus
- Riwayat transaksi dengan filter tanggal & kategori
- Ringkasan saldo bulan berjalan + streak pencatatan
- PIN lock app-level (opsional) — diminta ulang tiap kali app dibuka/di-resume
- Installable sebagai PWA (icon, splash, standalone mode)
- Real-time sync antar device lewat Supabase Realtime

## 🏗️ Arsitektur

**Local-first, bukan cache-first.** IndexedDB (via Dexie) adalah source of truth untuk UI — Supabase cuma "cermin" yang dikonsolidasi di background lewat outbox pattern:

1. Tiap mutation (create/update/delete transaksi/kategori) ditulis ke Dexie **dan** dicatat di `sync_queue` dalam satu transaksi atomic
2. Sync engine (`lib/sync/`) proses queue itu FIFO ke Supabase begitu online — push dengan retry + exponential backoff
3. Perubahan dari device lain masuk lewat Supabase Realtime subscription, di-merge pakai **Last-Write-Wins** berbasis `updated_at` yang di-set server (bukan client) — biar gak kena masalah jam device yang beda-beda
4. Delete pakai **tombstone** (soft delete), bukan hard delete — supaya urutan edit-vs-delete antar device tetap konsisten

Detail lengkap ada di komentar kode `lib/sync/push.ts`, `lib/sync/pull.ts`, dan `lib/sync/engine.ts`.

## 🧱 Tech Stack

| Layer | Pilihan |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript |
| Offline storage | Dexie.js (IndexedDB) |
| Backend | Supabase (Postgres + Auth + Realtime) |
| Styling | Tailwind CSS v4 + komponen custom (shadcn-style) |
| PWA | Serwist (service worker, app shell precaching) |

## 🚀 Setup Lokal

```bash
npm install
cp .env.local.example .env.local
# isi NEXT_PUBLIC_SUPABASE_URL & NEXT_PUBLIC_SUPABASE_ANON_KEY di .env.local
```

Jalankan migration SQL di **Supabase Dashboard → SQL Editor**, urut sesuai nomor:

```
supabase/migrations/0001_init.sql
supabase/migrations/0002_household_invite.sql
supabase/migrations/0005_leave_household.sql
```

> Migration `0003` dan `0004` (enable Realtime) **gak bisa** dijalankan lewat SQL Editor — role default gak punya privilege `ALTER PUBLICATION`. Aktifkan manual lewat **Supabase Dashboard → Database → Replication**, toggle tabel `transactions` dan `categories`.

```bash
npm run dev       # development (service worker nonaktif, biar gak ganggu HMR)
npm run build     # production build (service worker aktif)
npm run start     # jalankan hasil build
```

## 🧪 Testing Offline

Service worker **sengaja dimatikan** saat `next dev` (bentrok sama hot-reload). Untuk test offline beneran:

```bash
npm run build && npm run start
```

Lalu matikan koneksi internet **di browser/device**, bukan cuma toggle "Offline" di DevTools kalau server juga jalan di mesin yang sama (server butuh reach Supabase untuk auth — beda kasus dari PWA offline di production, di mana server ada di cloud dan selalu online).

## 📁 Struktur Folder

```
app/            # Next.js App Router pages
components/     # UI components (ui/, transaction/, category/, household/, ...)
lib/db/         # Dexie schema & query/mutation functions (outbox pattern)
lib/sync/       # Sync engine (push, pull, realtime, orchestration)
lib/supabase/   # Supabase client (browser, server, middleware)
actions/        # Next.js Server Actions
types/          # Shared TypeScript types (source of truth data model)
supabase/migrations/  # SQL schema + RLS policies
hooks/          # React hooks (household, current user, sync status, dll)
```

## ⚠️ Aturan Operasional Penting

**Jangan pernah edit atau hapus data (transaksi/kategori) langsung dari Supabase Dashboard/Table Editor.** Sistem sync ini bergantung penuh pada soft-delete tombstone (`deleted_at`) — kalau data dihapus manual dari database, device lain gak akan pernah tau data itu hilang dan bakal nyimpen copy stale selamanya, yang ujungnya bikin sync stuck permanen begitu device itu coba ngedit/hapus data yang sama. Selalu lakukan perubahan data lewat aplikasi.

## 🔒 Keamanan

- Row Level Security (RLS) di semua tabel — user cuma bisa akses data household miliknya sendiri
- Invite-to-household lewat `SECURITY DEFINER` RPC function yang divalidasi ketat, bukan expose tabel household mentah
- Household dibatasi maksimal 2 anggota
- `updated_at` transaksi di-set server (trigger), bukan client — mencegah manipulasi urutan conflict resolution

## 📄 Lisensi

Personal project — silakan lihat-lihat kodenya buat belajar, tapi bukan dimaksudkan sebagai template siap pakai.
