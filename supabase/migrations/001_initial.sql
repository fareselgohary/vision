-- The Vision group registration schema
create extension if not exists pgcrypto;

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  academic_year smallint not null check (academic_year between 1 and 5),
  group_number smallint not null check (group_number > 0),
  min_capacity smallint not null check (min_capacity > 0),
  max_capacity smallint not null check (max_capacity >= min_capacity),
  is_open boolean not null default true,
  created_at timestamptz not null default now(),
  unique (academic_year, group_number)
);

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (char_length(full_name) between 3 and 120),
  registration_number text not null check (registration_number ~ '^[0-9]{3,20}$'),
  academic_year smallint not null check (academic_year between 1 and 5),
  group_id uuid not null references public.groups(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (registration_number)
);

create index if not exists registrations_group_id_idx on public.registrations(group_id);
create index if not exists registrations_created_at_idx on public.registrations(created_at desc);
create index if not exists registrations_academic_year_idx on public.registrations(academic_year);

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.groups enable row level security;
alter table public.registrations enable row level security;
alter table public.admins enable row level security;

create or replace view public.group_availability
with (security_invoker = true)
as
select
  g.id,
  g.academic_year,
  g.group_number,
  g.min_capacity,
  g.max_capacity,
  count(r.id)::integer as registered_count,
  greatest(g.max_capacity - count(r.id), 0)::integer as remaining,
  g.is_open
from public.groups g
left join public.registrations r on r.group_id = g.id
group by g.id;

create or replace view public.registration_details
with (security_invoker = true)
as
select r.id, r.full_name, r.registration_number, r.academic_year,
       g.group_number, r.created_at
from public.registrations r
join public.groups g on g.id = r.group_id;

create or replace function public.register_student(
  p_full_name text,
  p_registration_number text,
  p_academic_year smallint,
  p_group_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_group public.groups%rowtype;
  current_count integer;
begin
  if exists (select 1 from public.registrations where registration_number = trim(p_registration_number)) then
    raise exception 'REGISTRATION_EXISTS' using errcode = '23505';
  end if;

  select * into target_group
  from public.groups
  where id = p_group_id and academic_year = p_academic_year
  for update;

  if not found then
    raise exception 'GROUP_NOT_FOUND' using errcode = 'P0001';
  end if;
  if not target_group.is_open then
    raise exception 'GROUP_CLOSED' using errcode = 'P0001';
  end if;

  select count(*) into current_count from public.registrations where group_id = p_group_id;
  if current_count >= target_group.max_capacity then
    raise exception 'GROUP_FULL' using errcode = 'P0001';
  end if;

  insert into public.registrations (full_name, registration_number, academic_year, group_id)
  values (trim(p_full_name), trim(p_registration_number), p_academic_year, p_group_id);

  return jsonb_build_object(
    'group_number', target_group.group_number,
    'academic_year', target_group.academic_year
  );
exception
  when unique_violation then
    raise exception 'REGISTRATION_EXISTS' using errcode = '23505';
end;
$$;

revoke all on function public.register_student(text, text, smallint, uuid) from public, anon, authenticated;
grant execute on function public.register_student(text, text, smallint, uuid) to service_role;

-- Seed the rules supplied by the Students' Union. Safe to run more than once.
insert into public.groups (academic_year, group_number, min_capacity, max_capacity)
select 2, n, 24, 25 from generate_series(1, 8) n
on conflict (academic_year, group_number) do update
set min_capacity = excluded.min_capacity, max_capacity = excluded.max_capacity;

insert into public.groups (academic_year, group_number, min_capacity, max_capacity)
select 3, n, 20, 22 from generate_series(1, 10) n
on conflict (academic_year, group_number) do update
set min_capacity = excluded.min_capacity, max_capacity = excluded.max_capacity;

insert into public.groups (academic_year, group_number, min_capacity, max_capacity)
select 4, n, 18, 20 from generate_series(1, 10) n
on conflict (academic_year, group_number) do update
set min_capacity = excluded.min_capacity, max_capacity = excluded.max_capacity;

-- Keep tables private; only the Cloudflare Function's service-role key can access them.
revoke all on public.groups, public.registrations, public.admins from anon, authenticated;
revoke all on public.group_availability, public.registration_details from anon, authenticated;
