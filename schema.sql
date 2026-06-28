-- Pro Integrate ATS Supabase Schema
-- Run this entire script in Supabase SQL Editor.
-- After your first admin user signs up, run the ADMIN BOOTSTRAP UPDATE at the bottom.

create extension if not exists pgcrypto;

-- 1) Roles
create type public.app_role as enum ('recruiter', 'recruitment_manager', 'sales', 'executive', 'admin');
create type public.candidate_stage as enum ('New', 'Screening', 'Endorsed', 'L1 Interview', 'L2 Interview', 'Final Interview', 'Offered', 'Hired', 'Rejected', 'Backout', 'On Hold');
create type public.requirement_status as enum ('Open', 'On Hold', 'Closed', 'Cancelled');

-- 2) Utility functions
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  full_name text,
  role public.app_role not null default 'recruiter',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at
before update on public.profiles
for each row execute procedure public.handle_updated_at();

create or replace function public.current_user_role()
returns public.app_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid() and is_active = true;
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.current_user_role() = 'admin', false);
$$;

create or replace function public.is_manager_or_above()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.current_user_role() in ('recruitment_manager', 'executive', 'admin'), false);
$$;

create or replace function public.can_manage_sales()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.current_user_role() in ('sales', 'recruitment_manager', 'executive', 'admin'), false);
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'recruiter'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- 3) Core ATS tables
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  industry text,
  contact_person text,
  contact_email text,
  status text not null default 'Active',
  owner_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger clients_updated_at before update on public.clients for each row execute procedure public.handle_updated_at();

create table if not exists public.requirements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  title text not null,
  headcount integer not null default 1,
  status public.requirement_status not null default 'Open',
  priority text default 'Medium',
  budget_min numeric(14,2),
  budget_max numeric(14,2),
  placement_fee_pct numeric(5,2) not null default 8.33,
  admin_fee_pct numeric(5,2) not null default 0,
  expected_start_date date,
  jd_storage_path text,
  jd_text text,
  created_by uuid references public.profiles(id) on delete set null,
  assigned_recruiter uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger requirements_updated_at before update on public.requirements for each row execute procedure public.handle_updated_at();

create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  location text,
  current_salary numeric(14,2),
  expected_salary numeric(14,2),
  source text,
  stage public.candidate_stage not null default 'New',
  client_id uuid references public.clients(id) on delete set null,
  requirement_id uuid references public.requirements(id) on delete set null,
  recruiter_id uuid references public.profiles(id) on delete set null,
  cv_storage_path text,
  parsed_cv_text text,
  duplicate_of uuid references public.candidates(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_candidates_email_lower on public.candidates (lower(email));
create index if not exists idx_candidates_phone on public.candidates (phone);
create index if not exists idx_candidates_stage on public.candidates (stage);
create index if not exists idx_candidates_recruiter on public.candidates (recruiter_id);
create trigger candidates_updated_at before update on public.candidates for each row execute procedure public.handle_updated_at();

create table if not exists public.candidate_stage_history (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  old_stage public.candidate_stage,
  new_stage public.candidate_stage not null,
  changed_by uuid references public.profiles(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.placements (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references public.candidates(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  requirement_id uuid references public.requirements(id) on delete set null,
  placement_date date not null default current_date,
  salary numeric(14,2) not null default 0,
  placement_fee_pct numeric(5,2) not null default 8.33,
  admin_fee_pct numeric(5,2) not null default 0,
  actual_revenue numeric(14,2) generated always as ((salary * placement_fee_pct / 100) + (salary * admin_fee_pct / 100)) stored,
  status text not null default 'Booked',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.sales_forecasts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  requirement_id uuid references public.requirements(id) on delete set null,
  forecast_month date not null,
  probability_pct numeric(5,2) not null default 50,
  expected_revenue numeric(14,2) not null default 0,
  actual_revenue numeric(14,2) not null default 0,
  owner_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger sales_forecasts_updated_at before update on public.sales_forecasts for each row execute procedure public.handle_updated_at();

create table if not exists public.report_logs (
  id uuid primary key default gen_random_uuid(),
  report_type text not null,
  filters jsonb,
  generated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 4) RLS policies
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.requirements enable row level security;
alter table public.candidates enable row level security;
alter table public.candidate_stage_history enable row level security;
alter table public.placements enable row level security;
alter table public.sales_forecasts enable row level security;
alter table public.report_logs enable row level security;

-- Profiles: authenticated users can see team names; only admin changes roles/status.
create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (true);
create policy "profiles_update_admin" on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Clients and requirements: visible to all signed-in users, editable by manager/sales/executive/admin.
create policy "clients_select_authenticated" on public.clients for select to authenticated using (true);
create policy "clients_insert_manager_sales" on public.clients for insert to authenticated with check (public.can_manage_sales());
create policy "clients_update_manager_sales" on public.clients for update to authenticated using (public.can_manage_sales()) with check (public.can_manage_sales());
create policy "clients_delete_admin" on public.clients for delete to authenticated using (public.is_admin());

create policy "requirements_select_authenticated" on public.requirements for select to authenticated using (true);
create policy "requirements_insert_manager_sales" on public.requirements for insert to authenticated with check (public.can_manage_sales());
create policy "requirements_update_manager_sales" on public.requirements for update to authenticated using (public.can_manage_sales()) with check (public.can_manage_sales());
create policy "requirements_delete_admin" on public.requirements for delete to authenticated using (public.is_admin());

-- Candidates: visible to all; recruiters can add and edit their own, managers/admin can edit all.
create policy "candidates_select_authenticated" on public.candidates for select to authenticated using (true);
create policy "candidates_insert_authenticated" on public.candidates for insert to authenticated with check (auth.uid() = created_by or public.is_manager_or_above());
create policy "candidates_update_owner_manager" on public.candidates for update to authenticated
  using (created_by = auth.uid() or recruiter_id = auth.uid() or public.is_manager_or_above())
  with check (created_by = auth.uid() or recruiter_id = auth.uid() or public.is_manager_or_above());
create policy "candidates_delete_admin" on public.candidates for delete to authenticated using (public.is_admin());

create policy "stage_history_select_authenticated" on public.candidate_stage_history for select to authenticated using (true);
create policy "stage_history_insert_authenticated" on public.candidate_stage_history for insert to authenticated with check (auth.uid() = changed_by or public.is_manager_or_above());

create policy "placements_select_authenticated" on public.placements for select to authenticated using (true);
create policy "placements_insert_manager_sales" on public.placements for insert to authenticated with check (public.can_manage_sales());
create policy "placements_update_manager_sales" on public.placements for update to authenticated using (public.can_manage_sales()) with check (public.can_manage_sales());
create policy "placements_delete_admin" on public.placements for delete to authenticated using (public.is_admin());

create policy "sales_forecasts_select_authenticated" on public.sales_forecasts for select to authenticated using (true);
create policy "sales_forecasts_insert_sales" on public.sales_forecasts for insert to authenticated with check (public.can_manage_sales());
create policy "sales_forecasts_update_sales" on public.sales_forecasts for update to authenticated using (public.can_manage_sales()) with check (public.can_manage_sales());
create policy "sales_forecasts_delete_admin" on public.sales_forecasts for delete to authenticated using (public.is_admin());

create policy "report_logs_select_manager" on public.report_logs for select to authenticated using (public.is_manager_or_above() or auth.uid() = generated_by);
create policy "report_logs_insert_authenticated" on public.report_logs for insert to authenticated with check (auth.uid() = generated_by);

-- 5) Storage buckets for CVs and JDs
insert into storage.buckets (id, name, public)
values ('cvs', 'cvs', false), ('jds', 'jds', false)
on conflict (id) do nothing;

create policy "storage_read_authenticated" on storage.objects
for select to authenticated using (bucket_id in ('cvs', 'jds'));

create policy "storage_insert_authenticated" on storage.objects
for insert to authenticated with check (bucket_id in ('cvs', 'jds'));

create policy "storage_update_owner_manager" on storage.objects
for update to authenticated using (owner = auth.uid() or public.is_manager_or_above())
with check (owner = auth.uid() or public.is_manager_or_above());

create policy "storage_delete_admin" on storage.objects
for delete to authenticated using (public.is_admin());

-- 6) Helpful views
create or replace view public.v_recruiter_productivity as
select
  p.id as recruiter_id,
  p.full_name as recruiter_name,
  count(c.id) as total_candidates,
  count(c.id) filter (where c.created_at >= date_trunc('month', now())) as month_candidates,
  count(c.id) filter (where c.stage = 'Endorsed') as endorsed,
  count(c.id) filter (where c.stage = 'Hired') as hired,
  coalesce(sum(pl.actual_revenue), 0) as actual_revenue
from public.profiles p
left join public.candidates c on c.recruiter_id = p.id
left join public.placements pl on pl.candidate_id = c.id
where p.role in ('recruiter', 'recruitment_manager')
group by p.id, p.full_name;

-- ADMIN BOOTSTRAP UPDATE:
-- 1. Sign up your admin email in the app first.
-- 2. Replace admin@email.com below with your real admin email, then run this once.
-- update public.profiles set role = 'admin', is_active = true where email = 'admin@email.com';
