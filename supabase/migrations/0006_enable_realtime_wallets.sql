-- Sama seperti transactions & categories, wallets juga butuh Realtime
-- diaktifkan supaya wallet baru yang dibuat satu user muncul otomatis
-- di device pacar. Kalau perintah ini gagal karena privilege (error
-- 42501 must be owner of publication supabase_realtime), aktifkan
-- manual lewat Supabase Dashboard -> Database -> Replication, toggle
-- tabel `wallets`.
alter publication supabase_realtime add table public.wallets;
