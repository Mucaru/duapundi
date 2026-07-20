# Self-Critique & PRD v1.1

Ditulis setelah MVP (fitur di PRD v1.0) selesai dan lolos test manual offline-sync 2 device. Tujuan dokumen ini: jujur soal apa yang masih kurang, biar prioritas pengembangan selanjutnya jelas — bukan cuma nambah fitur baru tapi juga nutup gap yang beresiko ganggu reliability.

---

## 🔴 Gap Kritis (harus ditutup sebelum dipakai jangka panjang)

### 1. Gak ada UI edit/hapus transaksi
Fungsi `updateTransactionLocal` dan `deleteTransactionLocal` udah ada di `lib/db/transactions.ts` (lengkap dengan outbox pattern), tapi **gak ada satupun tombol di UI** yang manggil mereka. Kalau kamu salah ketik nominal atau salah pilih kategori, sekarang **gak ada cara buat betulin** selain langsung ke Supabase Table Editor. Ini gap paling mendesak — realistis bakal langsung kejadian dalam minggu pertama pemakaian.

**Rekomendasi:** tap transaksi di list → buka detail sheet → edit nominal/kategori/catatan atau hapus (dengan konfirmasi).

### 2. Gak ada konfirmasi sebelum aksi destruktif
Hapus kategori (`deleteCategoryLocal`) langsung eksekusi begitu tombol tempat sampah di-tap, gak ada dialog "yakin?". Kalau tanpa sengaja kepencet, kategori hilang (soft-delete sih, jadi teknisnya masih bisa di-restore manual dari database, tapi user gak tau itu).

**Rekomendasi:** confirm dialog sederhana untuk delete kategori & (nanti) delete transaksi.

### 3. Belum ada keputusan soal PIN/biometric lock
PRD awal nyebut ini sebagai "acceptable risk atau perlu proteksi tambahan" — kita defer keputusannya pas Tahap 6 dan belum pernah balik lagi. IndexedDB gak ter-enkripsi secara default, dan HP yang gak ke-lock bisa langsung buka app kalau session masih aktif.

**Rekomendasi:** untuk app data keuangan personal dipegang berdua, saran aku PIN 4-6 digit di app-level (bukan biometric — biometric butuh native API yang gak reliable di PWA browser) yang muncul tiap kali app dibuka/di-resume, disimpan hash-nya di localStorage.

### 4. Gak ada cara keluar dari household
Kalau salah invite orang yang salah, atau household perlu di-reset, gak ada tombol "keluar dari household" atau "hapus household". Sekarang cuma bisa diakalin manual lewat database.

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

### P0 (sebelum pemakaian harian serius)
1. Edit & hapus transaksi (UI)
2. Confirm dialog untuk aksi destruktif
3. Keputusan + implementasi PIN lock
4. Tombol keluar dari household

### P1 (pengalaman harian lebih lengkap)
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

Tapi dari sisi "siap dipakai harian tanpa drama", gap paling nyata adalah **poin P0** — khususnya gak bisa edit/hapus transaksi. Itu bakal jadi hal pertama yang bikin frustrasi begitu ada typo pertama kali. Saran aku: kerjain P0 dulu semua sebelum nambah fitur baru apapun dari Fase 2/3.
