-- Registration is final: a registration number can never be moved to another group.
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
begin
  select * into existing_registration
  from public.registrations
  where registration_number = trim(p_registration_number)
  for update;

  if existing_registration.id is not null then
    raise exception 'REGISTRATION_EXISTS' using errcode = 'P0001';
  end if;

  select * into target_group
  from public.groups
  where id = p_group_id and academic_year = p_academic_year
  for update;

  if not found then raise exception 'GROUP_NOT_FOUND' using errcode = 'P0001'; end if;
  if not target_group.is_open then raise exception 'GROUP_CLOSED' using errcode = 'P0001'; end if;

  select count(*) into current_count from public.registrations where group_id = p_group_id;
  if current_count >= target_group.max_capacity then raise exception 'GROUP_FULL' using errcode = 'P0001'; end if;

  insert into public.registrations (registration_number, academic_year, group_id)
  values (trim(p_registration_number), p_academic_year, p_group_id);

  insert into public.registration_history (registration_number, event_type, to_group_id)
  values (trim(p_registration_number), 'registered', p_group_id);

  return jsonb_build_object('group_number', target_group.group_number, 'academic_year', target_group.academic_year);
end;
$$;

revoke all on function public.register_student(text, text, smallint, uuid) from public, anon, authenticated;
grant execute on function public.register_student(text, text, smallint, uuid) to service_role;

-- Fifth year: Group A through Group H, each with exactly 18 places.
-- New groups start closed; an admin opens the whole year from the dashboard.
insert into public.groups (academic_year, group_number, min_capacity, max_capacity, is_open)
select 5, n, 18, 18, false from generate_series(1, 8) n
on conflict (academic_year, group_number) do update
set min_capacity = excluded.min_capacity,
    max_capacity = excluded.max_capacity;
