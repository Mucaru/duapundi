# Self-Critique & PRD v1.1

> **Update v1.2:** item di bawah ini udah dikerjain — (A) update-operation orphan handling, (B) multi-tab leader lock, (C) Sync Log observability, plus fitur baru: **multi-wallet** (privat/shared) dan **visibilitas per-user** (filter + breakdown pengeluaran per orang). Sisa backlog: budget per kategori, export CSV, unit test sync engine, pagination.

Ditulis setelah MVP (fitur di PRD v1.0) selesai dan lolos test manual offline-sync 2 device. Tujuan dokumen ini: jujur soal apa yang masih kurang, biar prioritas pengembangan selanjutnya jelas — bukan cuma nambah fitur baru tapi juga nutup gap yang beresiko ganggu reliability.

---

## 🆕 Post-Mortem v1.1 — Gap yang ketemu dari testing real

Setelah P0 selesai dan dipakai bentar, muncul beberapa gap baru yang gak kepikiran waktu desain awal:

### A. Manual edit langsung ke Supabase Dashboard ngerusak asumsi sync
Kejadian nyata: transaksi dihapus manual dari Supabase (bukan lewat app) sebelum fitur delete ada. Sistem sync kita 100% bergantung pada **soft-delete tombstone** — hard delete manual bikin device lain gak pernah tau row itu hilang, nyimpen copy stale selamanya. Begitu transaksi itu coba dihapus dari app, sync engine push `UPDATE` ke row yang udah gak ada, gagal terus, stuck permanen tanpa auto-recovery (udah di-fix, lihat bawah).

**Status:** sebagian ke-mitigasi — `processItem` sekarang treat "delete row yang emang udah gak ada" sebagai sukses, dan ada `resetStuckItems()` yang ngasih item stuck kesempatan retry ulang tiap app dibuka. **Tapi** kasus serupa untuk **update** (edit transaksi yang row-nya udah dihapus manual) belum di-handle — masih bakal stuck kalau kejadian.

**Rekomendasi:** (1) dokumentasikan eksplisit "jangan pernah edit/hapus data langsung dari Supabase Dashboard, selalu lewat app" sebagai operational rule, (2) terapkan fix serupa (treat 0-rows-matched sebagai kondisi yang di-handle graceful) untuk operasi `update`, bukan cuma `delete`.

### B. Multi-tab di device yang sama belum dipikirin
Kalau user buka app di 2 tab browser sekaligus (device sama), masing-masing tab jalanin sync engine sendiri-sendiri — subscribe Realtime channel dobel, dan berpotensi race condition kalau kedua tab bareng-bareng coba proses item `sync_queue` yang sama (keduanya baca item sebelum salah satu sempat hapus dari queue → percobaan insert dobel → conflict di primary key). Belum pernah dites eksplisit, tapi secara desain ini celah nyata.

**Rekomendasi:** minimal, pakai `BroadcastChannel` API atau leader election sederhana biar cuma 1 tab yang jalanin sync engine per browser session.

### C. Auto-retry item stuck bisa nutupin kegagalan yang beneran perlu perhatian
`resetStuckItems()` yang baru ditambah bagus buat kasus "row udah gak ada di server", tapi kalau ada error lain yang **genuinely perlu campur tangan manual** (misal data corrupt, foreign key rujuk ke row yang beneran gak valid), sistem bakal terus nyoba diam-diam tiap app dibuka tanpa pernah kasih tau user secara eksplisit "ini butuh dicek manual". Trade-off yang sengaja diambil demi UX, tapi perlu diinget.

---

## 🔴 Gap Kritis — STATUS v1.1

> Update: keempat item P0 di bawah ini udah dikerjakan di v1.1. Bagian asli dipertahankan sebagai catatan kenapa ini prioritas awalnya.

### 1. ~~Gak ada UI edit/hapus transaksi~~ ✅ Selesai (v1.1)
Tap transaksi di list sekarang buka `TransactionDetailSheet` — bisa edit nominal/kategori/catatan, atau hapus (dengan konfirmasi).
Fungsi `updateTransactionLocal` dan `deleteTransactionLocal` udah ada di `lib/db/transactions.ts` (lengkap dengan outbox pattern), tapi **gak ada satupun tombol di UI** yang manggil mereka. Kalau kamu salah ketik nominal atau salah pilih kategori, sekarang **gak ada cara buat betulin** selain langsung ke Supabase Table Editor. Ini gap paling mendesak — realistis bakal langsung kejadian dalam minggu pertama pemakaian.

**Rekomendasi:** tap transaksi di list → buka detail sheet → edit nominal/kategori/catatan atau hapus (dengan konfirmasi).

### 2. ~~Gak ada konfirmasi sebelum aksi destruktif~~ ✅ Selesai (v1.1)
`ConfirmDialog` reusable dipakai di delete kategori, delete transaksi, keluar household, dan matiin PIN.
Hapus kategori (`deleteCategoryLocal`) langsung eksekusi begitu tombol tempat sampah di-tap, gak ada dialog "yakin?". Kalau tanpa sengaja kepencet, kategori hilang (soft-delete sih, jadi teknisnya masih bisa di-restore manual dari database, tapi user gak tau itu).

**Rekomendasi:** confirm dialog sederhana untuk delete kategori & (nanti) delete transaksi.

### 3. ~~Belum ada keputusan soal PIN/biometric lock~~ ✅ Selesai (v1.1)
Diputuskan pakai PIN 6 digit app-level (bukan biometric, karena PWA browser gak reliable akses native biometric API). Hash SHA-256 via Web Crypto disimpan di localStorage, dicek ulang tiap kali app disembunyikan lalu di-resume (`visibilitychange`). **Penting: ini gerbang tampilan, bukan enkripsi data** — IndexedDB tetap plain text, dijelaskan eksplisit di UI biar gak ada ekspektasi salah soal level proteksinya.

### 4. ~~Gak ada cara keluar dari household~~ ✅ Selesai (v1.1)
Tombol "Keluar dari household" di `InviteSheet`, dengan `ConfirmDialog` dan RPC `leave_household()` (`SECURITY DEFINER`, cuma clear `household_id` di profile, data household/transaksi gak dihapus).

---

## 🟡 Gap Teknis (gak mendesak, tapi berisiko kalau dibiarkan lama)

### 5. Zero automated tests
Semua testing sejauh ini manual (kamu klik-klik, screenshot, aku baca). Untuk logic sekritis sync engine (conflict resolution, outbox retry, LWW merge), ini beresiko — perubahan kecil di masa depan bisa diam-diam ngerusak behavior yang udah jalan tanpa ketauan sampai kejadian nyata di device kamu.

**Rekomendasi minimal:** unit test untuk `lib/sync/push.ts` dan `lib/sync/pull.ts` (terutama fungsi `mergeRemoteTransaction` — logic LWW-nya harus punya test case eksplisit untuk skenario "local lebih baru", "remote lebih baru", "ada pending queue").

### 6. Observability nol di production
Error di sync engine cuma keliatan di `console.warn` (dev-only). Begitu kamu pakai app ini beneran (bukan dev server), kalau ada transaksi yang stuck gagal sync, kamu **gak akan tau** kecuali buka DevTools manual. Gak ada alerting.

**Rekomendasi:** minimal, badge "gagal sync" yang sekarang ada di header cukup sebagai sinyal visual — tapi pertimbangkan juga log ke suatu tempat yang bisa dicek (Sentry free tier, atau paling sederhana: tabel `sync_errors` di Supabase yang di-insert pas gagal permanen, biar bisa di-query manual kalau ada masalah).

### 7. Transaction list gak di-paginate
Semua transaksi household di-load penuh dari Dexie ke memory tiap render. Untuk pemakaian beberapa bulan ke depan (ratusan-ribuan transaksi), ini bisa mulai kerasa lambat. Gak masalah sekarang, tapi bakal jadi masalah.

**Rekomendasi:** infinite scroll / load-more per 50 transaksi, atau minimal batasi list ke rentang filter aktif (udah ada filter tanggal, tinggal pastikan query-nya beneran narrow, bukan load semua terus filter di JS kayak sekarang).

### 8. Reconnection websocket belum divalidasi
Supabase Realtime seharusnya auto-reconnect kalau koneksi putus-nyambung, tapi ini belum pernah dites eksplisit (misal: buka app, matiin wifi 5 menit, nyalain lagi — apakah Realtime subscription otomatis pulih atau perlu refresh manual).

---

## 🟢 Fitur yang Belum Ada (dari PRD asli, sengaja belum dikerjakan)

Sesuai urutan prioritas PRD v1.0 kamu sendiri (Fase 2 & 3):

- Shared expense / split bill (siapa hutang siapa)
- Budget per kategori + notifikasi mendekati limit
- Grafik & insight (trend, kategori paling boros)
- Multi-wallet UI (schema udah support, tapi cuma ada 1 wallet "Cash" default — belum ada UI buat nambah wallet baru kayak e-wallet/bank/dompet bisnis Mucaru Store)
- Export CSV/Excel
- Recurring transaction
- Reminder harian
- Foto struk

---

## 📋 PRD v1.1 — Prioritas Berikutnya

### ~~P0 (sebelum pemakaian harian serius)~~ ✅ Semua selesai di v1.1
1. ~~Edit & hapus transaksi (UI)~~
2. ~~Confirm dialog untuk aksi destruktif~~
3. ~~Keputusan + implementasi PIN lock~~
4. ~~Tombol keluar dari household~~

### P1 (fokus selanjutnya — pengalaman harian lebih lengkap)
5. Multi-wallet UI (tambah/edit wallet, pilih wallet pas input transaksi — sekarang hardcoded ke wallet pertama)
6. Budget per kategori + indikator mendekati limit di kategori terkait
7. Export CSV
8. Unit test untuk sync engine (minimal `mergeRemoteTransaction` + `flushQueue` retry logic)

### P2 (nice to have, gak mendesak)
9. Grafik/insight sederhana (Recharts udah ke-install dari awal, belum dipakai sama sekali)
10. Shared expense / split bill
11. Recurring transaction
12. Foto struk
13. Reminder harian

### Tech debt berkelanjutan
- Observability/error tracking minimal
- Pagination transaction list
- Splash screen iOS custom (skip di v1.0)

---

## Catatan Jujur

MVP ini **solid di fondasi** — offline-first dan sync engine-nya udah melewati beberapa bug nyata (ID format, race condition closure, silent failure) dan sekarang provably bekerja di test 2-device. Itu bagian tersulit dan udah kelar dengan benar.

**Update v1.1:** semua gap P0 (edit/hapus transaksi, confirm dialog, PIN lock, keluar household) udah ditutup. App sekarang layak dipakai harian tanpa drama. Fokus berikutnya pindah ke P1 — terutama multi-wallet (biar bisa pisahin dompet pribadi vs bisnis sesuai kebutuhan awal di PRD) dan budget per kategori.
