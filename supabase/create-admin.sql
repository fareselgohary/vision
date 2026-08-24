-- 1) Create the admin in Supabase Dashboard > Authentication > Users.
-- 2) Replace the email below, then run this in Supabase SQL Editor.
insert into public.admins (user_id)
select id from auth.users where email = 'admin@example.com'
on conflict (user_id) do nothing;
