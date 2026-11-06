-- Manual photo annotations live separately from the rotating ig_accounts.media cache.
create table public.ig_photo_tags (
  post_key text not null check (post_key ~ '^[A-Za-z0-9_-]{1,64}$'),
  photo_key text not null check (length(photo_key) between 1 and 300),
  handle text not null check (handle ~ '^[a-z0-9_.]{1,30}$'),
  media_id text check (media_id is null or media_id ~ '^[0-9]{1,64}$'),
  image_key text not null check (length(image_key) between 1 and 240),
  artist_ids text[] not null check (
    cardinality(artist_ids) between 1 and 50
    and array_position(artist_ids,null) is null
    and array_to_string(artist_ids,',') ~ '^a[0-9]{4,}(,a[0-9]{4,})*$'
  ),
  revision bigint not null default 1 check (revision > 0),
  primary key (post_key,photo_key)
);
alter table public.ig_photo_tags enable row level security;
revoke all on public.ig_photo_tags from public,anon,authenticated;
grant select on public.ig_photo_tags to anon,authenticated;
grant insert,update,delete on public.ig_photo_tags to authenticated;
grant all on public.ig_photo_tags to service_role;
create policy "ig photo tags public read" on public.ig_photo_tags
  for select to anon,authenticated using (true);
-- Same signed-in admin identity as the existing video editor, never user_metadata.
create policy "ig photo tags admin insert" on public.ig_photo_tags
  for insert to authenticated with check (
    (select auth.uid()) is not null
    and (select auth.jwt()->>'email')='bethej2love@gmail.com'
    and coalesce((select auth.jwt()->>'is_anonymous'),'false')='false'
  );
create policy "ig photo tags admin update" on public.ig_photo_tags
  for update to authenticated using (
    (select auth.uid()) is not null
    and (select auth.jwt()->>'email')='bethej2love@gmail.com'
    and coalesce((select auth.jwt()->>'is_anonymous'),'false')='false'
  ) with check (
    (select auth.uid()) is not null
    and (select auth.jwt()->>'email')='bethej2love@gmail.com'
    and coalesce((select auth.jwt()->>'is_anonymous'),'false')='false'
  );
create policy "ig photo tags admin delete" on public.ig_photo_tags
  for delete to authenticated using (
    (select auth.uid()) is not null
    and (select auth.jwt()->>'email')='bethej2love@gmail.com'
    and coalesce((select auth.jwt()->>'is_anonymous'),'false')='false'
  );
notify pgrst,'reload schema';
