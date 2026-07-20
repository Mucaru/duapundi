-- Sama seperti transactions, categories juga butuh didaftarkan eksplisit
-- ke publication supabase_realtime supaya kategori custom yang dibuat
-- satu user muncul otomatis di device pacar tanpa refresh.
alter publication supabase_realtime add table public.categories;
