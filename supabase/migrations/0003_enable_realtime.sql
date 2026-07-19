-- Realtime tidak aktif otomatis per tabel di Supabase — harus didaftarkan
-- eksplisit ke publication supabase_realtime. Tanpa ini, pull.ts (Realtime
-- subscription) tidak akan pernah menerima event apapun.
alter publication supabase_realtime add table public.transactions;
