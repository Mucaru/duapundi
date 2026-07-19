-- =========================================================
-- Money Tracker — Household invite flow
-- =========================================================
-- Kenapa perlu RPC khusus (bukan langsung query households table):
-- RLS policy "households_select_member" mengharuskan
-- id = current_household_id() — tapi user yang mau JOIN household
-- belum punya household_id sama sekali (null). Kalau kita buka policy
-- select households buat semua orang, itu bocor (orang asing bisa
-- enumerate semua household). Solusinya: function SECURITY DEFINER
-- yang cuma mengizinkan 1 operasi sempit — "join kalau invite_code cocok
-- persis" — bukan general read access ke tabel households.

create or replace function public.join_household_by_invite_code(code text)
returns uuid
language plpgsql
security definer
as $$
declare
  target_household_id uuid;
  caller_id uuid;
  caller_current_household uuid;
begin
  caller_id := auth.uid();
  if caller_id is null then
    raise exception 'not_authenticated';
  end if;

  select household_id into caller_current_household
    from public.profiles where id = caller_id;

  if caller_current_household is not null then
    raise exception 'already_in_household';
  end if;

  select id into target_household_id
    from public.households
    where invite_code = code;

  if target_household_id is null then
    raise exception 'invalid_invite_code';
  end if;

  -- Batasi maksimal 2 anggota per household (sesuai use case "berdua").
  if (select count(*) from public.profiles where household_id = target_household_id) >= 2 then
    raise exception 'household_full';
  end if;

  update public.profiles
    set household_id = target_household_id
    where id = caller_id;

  return target_household_id;
end;
$$;

-- Function untuk bikin household baru + langsung join sebagai anggota pertama.
create or replace function public.create_household(household_name text)
returns uuid
language plpgsql
security definer
as $$
declare
  new_household_id uuid;
  caller_id uuid;
  caller_current_household uuid;
begin
  caller_id := auth.uid();
  if caller_id is null then
    raise exception 'not_authenticated';
  end if;

  select household_id into caller_current_household
    from public.profiles where id = caller_id;

  if caller_current_household is not null then
    raise exception 'already_in_household';
  end if;

  insert into public.households (name, created_by)
    values (household_name, caller_id)
    returning id into new_household_id;

  update public.profiles
    set household_id = new_household_id
    where id = caller_id;

  -- Seed kategori default biar household baru gak mulai dari kosong.
  insert into public.categories (household_id, name, type, icon, color, is_favorite, sort_order)
  values
    (new_household_id, 'Makan', 'expense', 'utensils', '#B5533C', true, 1),
    (new_household_id, 'Transport', 'expense', 'car', '#B5533C', true, 2),
    (new_household_id, 'Belanja', 'expense', 'shopping-bag', '#B5533C', true, 3),
    (new_household_id, 'Tagihan', 'expense', 'receipt', '#B5533C', false, 4),
    (new_household_id, 'Hiburan', 'expense', 'popcorn', '#B5533C', false, 5),
    (new_household_id, 'Kesehatan', 'expense', 'heart-pulse', '#B5533C', false, 6),
    (new_household_id, 'Lainnya', 'expense', 'more-horizontal', '#B5533C', false, 99),
    (new_household_id, 'Gaji', 'income', 'banknote', '#2E7D5B', true, 1),
    (new_household_id, 'Bonus', 'income', 'gift', '#2E7D5B', false, 2),
    (new_household_id, 'Lainnya', 'income', 'more-horizontal', '#2E7D5B', false, 99);

  -- Seed satu wallet default "Cash" biar bisa langsung catat transaksi.
  insert into public.wallets (household_id, name, type, icon)
  values (new_household_id, 'Cash', 'cash', 'wallet');

  return new_household_id;
end;
$$;

-- Regenerate invite code (misal kalau khawatir kode lama kebocor).
create or replace function public.regenerate_invite_code()
returns text
language plpgsql
security definer
as $$
declare
  caller_household uuid;
  new_code text;
begin
  select household_id into caller_household
    from public.profiles where id = auth.uid();

  if caller_household is null then
    raise exception 'no_household';
  end if;

  new_code := encode(gen_random_bytes(6), 'hex');

  update public.households
    set invite_code = new_code
    where id = caller_household;

  return new_code;
end;
$$;
