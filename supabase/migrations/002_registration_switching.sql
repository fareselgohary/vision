-- Registration numbers identify a student's choice. A later confirmed choice moves
-- that same student atomically, releasing the old seat and taking the new one.
alter table public.registrations alter column full_name drop not null;

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
  select * into existing_registration
  from public.registrations
  where registration_number = trim(p_registration_number)
  for update;

  -- Lock the old and desired group rows in one stable order. This makes capacity
  -- checks safe even when hundreds of students submit at the same time.
  perform 1 from public.groups
  where id in (p_group_id, existing_registration.group_id)
  order by id
  for update;

  select * into target_group
  from public.groups
  where id = p_group_id and academic_year = p_academic_year;

  if not found then raise exception 'GROUP_NOT_FOUND' using errcode = 'P0001'; end if;
  if not target_group.is_open then raise exception 'GROUP_CLOSED' using errcode = 'P0001'; end if;

  if found and existing_registration.id is not null and existing_registration.group_id = p_group_id then
    return jsonb_build_object(
      'group_number', target_group.group_number,
      'academic_year', target_group.academic_year,
      'already_registered', true,
      'was_changed', false
    );
  end if;

  select count(*) into current_count from public.registrations where group_id = p_group_id;
  if current_count >= target_group.max_capacity then raise exception 'GROUP_FULL' using errcode = 'P0001'; end if;

  if existing_registration.id is null then
    insert into public.registrations (registration_number, academic_year, group_id)
    values (trim(p_registration_number), p_academic_year, p_group_id);
  else
    update public.registrations
    set academic_year = p_academic_year, group_id = p_group_id
    where id = existing_registration.id;
    was_changed := true;
  end if;

  return jsonb_build_object(
    'group_number', target_group.group_number,
    'academic_year', target_group.academic_year,
    'already_registered', existing_registration.id is not null,
    'was_changed', was_changed
  );
end;
$$;

revoke all on function public.register_student(text, text, smallint, uuid) from public, anon, authenticated;
grant execute on function public.register_student(text, text, smallint, uuid) to service_role;
