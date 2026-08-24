create table if not exists public.registration_history (
  id uuid primary key default gen_random_uuid(),
  registration_number text not null,
  event_type text not null check (event_type in ('registered', 'moved')),
  from_group_id uuid references public.groups(id) on delete set null,
  to_group_id uuid not null references public.groups(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists registration_history_registration_number_idx on public.registration_history(registration_number, created_at desc);
create index if not exists registration_history_to_group_idx on public.registration_history(to_group_id, created_at desc);
alter table public.registration_history enable row level security;
revoke all on public.registration_history from anon, authenticated;

create or replace view public.registration_history_details
with (security_invoker = true)
as
select h.id, h.registration_number, h.event_type, h.from_group_id, h.to_group_id, h.created_at,
       source.group_number as from_group_number, destination.group_number as to_group_number,
       source.academic_year as from_academic_year, destination.academic_year as to_academic_year
from public.registration_history h
left join public.groups source on source.id = h.from_group_id
join public.groups destination on destination.id = h.to_group_id;

revoke all on public.registration_history_details from anon, authenticated;

create or replace view public.registration_details
with (security_invoker = true)
as
select r.id, r.full_name, r.registration_number, r.academic_year,
       g.group_number, r.created_at, r.group_id
from public.registrations r
join public.groups g on g.id = r.group_id;

revoke all on public.registration_details from anon, authenticated;

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
  existing_registration public.registrations%rowtype;
  target_group public.groups%rowtype;
  current_count integer;
  was_changed boolean := false;
begin
  select * into existing_registration from public.registrations
  where registration_number = trim(p_registration_number) for update;
  perform 1 from public.groups where id in (p_group_id, existing_registration.group_id) order by id for update;
  select * into target_group from public.groups where id = p_group_id and academic_year = p_academic_year;
  if not found then raise exception 'GROUP_NOT_FOUND' using errcode = 'P0001'; end if;
  if not target_group.is_open then raise exception 'GROUP_CLOSED' using errcode = 'P0001'; end if;
  if existing_registration.id is not null and existing_registration.group_id = p_group_id then
    return jsonb_build_object('group_number', target_group.group_number, 'academic_year', target_group.academic_year, 'already_registered', true, 'was_changed', false);
  end if;
  select count(*) into current_count from public.registrations where group_id = p_group_id;
  if current_count >= target_group.max_capacity then raise exception 'GROUP_FULL' using errcode = 'P0001'; end if;
  if existing_registration.id is null then
    insert into public.registrations (registration_number, academic_year, group_id) values (trim(p_registration_number), p_academic_year, p_group_id);
    insert into public.registration_history (registration_number, event_type, to_group_id) values (trim(p_registration_number), 'registered', p_group_id);
  else
    update public.registrations set academic_year = p_academic_year, group_id = p_group_id where id = existing_registration.id;
    insert into public.registration_history (registration_number, event_type, from_group_id, to_group_id) values (trim(p_registration_number), 'moved', existing_registration.group_id, p_group_id);
    was_changed := true;
  end if;
  return jsonb_build_object('group_number', target_group.group_number, 'academic_year', target_group.academic_year, 'already_registered', existing_registration.id is not null, 'was_changed', was_changed);
end;
$$;
