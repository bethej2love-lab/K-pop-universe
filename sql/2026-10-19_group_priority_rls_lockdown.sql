-- Emergency RLS lockdown for group_priority (2026-10-19).
--
-- Finding: the public anon key can SELECT 269 rows and an empty INSERT passes RLS.
-- This is an admin-only operational-priority table; the public app uses baked `pri`
-- values in groups.json instead.
-- A restrictive policy is ANDed with existing permissive policies, so this closes
-- public reads/writes without replacing unknown existing administrator policies.

alter table public.group_priority enable row level security;

create policy "group_priority_admin_only"
on public.group_priority
as restrictive
for all
to anon, authenticated
using (coalesce(auth.jwt() ->> 'email', '') = 'bethej2love@gmail.com')
with check (coalesce(auth.jwt() ->> 'email', '') = 'bethej2love@gmail.com');

-- After applying, run: node tests/rls.test.js
-- group_priority must report "0 rows readable / write blocked by RLS".
