-- Sama seperti transactions/categories/wallets, budgets juga butuh
-- Realtime diaktifkan supaya perubahan budget dari satu user muncul
-- otomatis di device pacar. Kalau gagal karena privilege (42501 must
-- be owner of publication), aktifkan manual lewat Supabase Dashboard
-- -> Database -> Replication, toggle tabel `budgets`.
alter publication supabase_realtime add table public.budgets;
