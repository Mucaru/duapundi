-- =========================================================
-- Money Tracker — Initial schema + RLS
-- =========================================================
-- Prinsip keamanan: SEMUA akses ke data dibatasi lewat household_id
-- milik user yang sedang login (auth.uid()). Tidak ada query yang bisa
-- menembus household lain, bahkan lewat direct API call ke Supabase
-- (RLS berlaku di level database, bukan cuma di app layer).

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------
-- households (dibuat duluan, jadi FK target untuk profiles)
-- ---------------------------------------------------------
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique default encode(gen_random_bytes(6), 'hex'),
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- profiles (extend auth.users dengan household_id)
-- ---------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text not null,
  household_id uuid references public.households (id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- wallets
-- ---------------------------------------------------------
create table public.wallets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  type text not null check (type in ('cash', 'ewallet', 'bank', 'business')),
  owner_user_id uuid references auth.users (id), -- null = shared wallet
  icon text not null default 'wallet',
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------------------------------------------------------
-- categories
-- ---------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  type text not null check (type in ('income', 'expense')),
  icon text not null default 'circle',
  color text not null default '#1F5C4E',
  is_favorite boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ---------------------------------------------------------
-- transactions
-- ---------------------------------------------------------
create table public.transactions (
  id uuid primary key, -- client-generated, JANGAN default gen_random_uuid() di sini
  household_id uuid not null references public.households (id) on delete cascade,
  wallet_id uuid not null references public.wallets (id),
  category_id uuid not null references public.categories (id),
  user_id uuid not null references auth.users (id),
  amount bigint not null check (amount > 0),
  type text not null check (type in ('income', 'expense')),
  note text,
  date date not null,
  is_shared boolean not null default false,
  split_with jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(), -- di-set ulang oleh trigger tiap write, server-authoritative
  deleted_at timestamptz,
  edited_by_user_id uuid not null references auth.users (id)
);

create index transactions_household_date_idx
  on public.transactions (household_id, date desc)
  where deleted_at is null;

-- Trigger: updated_at SELALU di-override server, client tidak boleh
-- kirim nilai sendiri untuk field ini (mencegah client dengan jam salah
-- memenangkan conflict resolution secara curang / gak sengaja).
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

create trigger wallets_set_updated_at
  before update on public.wallets
  for each row execute function public.set_updated_at();

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------
-- budgets
-- ---------------------------------------------------------
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  category_id uuid not null references public.categories (id),
  month text not null, -- 'YYYY-MM'
  limit_amount bigint not null check (limit_amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, category_id, month)
);

-- =========================================================
-- Row Level Security
-- =========================================================
alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.wallets enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;

-- Helper: household_id milik user yang sedang login.
-- SECURITY DEFINER supaya bisa dipanggil dalam policy tanpa recursive RLS check.
create or replace function public.current_household_id()
returns uuid
language sql
security definer
stable
as $$
  select household_id from public.profiles where id = auth.uid();
$$;

-- profiles: user cuma bisa lihat/update profile sendiri + profile
-- anggota household yang sama (biar bisa tampilkan nama pacar).
create policy "profiles_select_self_or_household"
  on public.profiles for select
  using (
    id = auth.uid()
    or household_id = public.current_household_id()
  );

create policy "profiles_update_self"
  on public.profiles for update
  using (id = auth.uid());

-- households: cuma anggota household itu sendiri yang bisa lihat.
create policy "households_select_member"
  on public.households for select
  using (id = public.current_household_id());

-- Insert household: hanya lewat server action terverifikasi (service role
-- atau user yang belum punya household), lihat actions/household.ts
create policy "households_insert_own"
  on public.households for insert
  with check (created_by = auth.uid());

-- wallets / categories / transactions / budgets:
-- pola sama — select/insert/update/delete HANYA jika household_id row
-- tersebut sama dengan household_id user yang login. Ini yang menjamin
-- 2 household yang berbeda TIDAK PERNAH bisa saling lihat data,
-- walau tahu ID row-nya sekalipun.
create policy "wallets_all_household_scoped"
  on public.wallets for all
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

create policy "categories_all_household_scoped"
  on public.categories for all
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

create policy "transactions_all_household_scoped"
  on public.transactions for all
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

create policy "budgets_all_household_scoped"
  on public.budgets for all
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

-- ---------------------------------------------------------
-- Auto-create profile saat user baru sign up
-- ---------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
