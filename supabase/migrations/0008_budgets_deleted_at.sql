-- Tabel budgets ketinggalan 2 hal krusial dari setup awal (kelewat pas
-- migration 0001 dulu, ketauan pas mau bangun fitur budget):
-- 1. deleted_at — tanpa ini, delete budget bakal kena bug yang sama
--    kayak transactions/categories/wallets dulu (soft-delete gak bisa
--    propagate ke device lain, karena gak ada kolom buat nandain).
-- 2. Trigger updated_at server-authoritative — tanpa ini, conflict
--    resolution (LWW) budget gak reliable karena updated_at bisa aja
--    ketinggalan gak keupdate otomatis pas ada perubahan.

alter table public.budgets
  add column deleted_at timestamptz;

create trigger budgets_set_updated_at
  before update on public.budgets
  for each row execute function public.set_updated_at();

-- RLS budgets udah di-cover sama policy "budgets_all_household_scoped"
-- dari migration 0001 (household_id = current_household_id()), gak
-- perlu policy baru.
