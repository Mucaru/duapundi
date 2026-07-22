-- Keluar dari household. Tidak menghapus data household/transaksi (biar
-- anggota lain yang masih ada gak kehilangan histori), cuma melepas
-- keanggotaan user yang minta keluar.
create or replace function public.leave_household()
returns void
language plpgsql
security definer
as $$
declare
  caller_id uuid;
begin
  caller_id := auth.uid();
  if caller_id is null then
    raise exception 'not_authenticated';
  end if;

  update public.profiles
    set household_id = null
    where id = caller_id;
end;
$$;
