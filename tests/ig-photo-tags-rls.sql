-- Run after sql/2026-11-06_ig_photo_tags.sql. All fixtures roll back.
begin;
insert into public.ig_photo_tags(post_key,photo_key,handle,media_id,image_key,artist_ids)
values ('codex_ig_tags_rls_fixture','id:123456','cortis','123456','fixture.jpg',array['a0001']);
set local role anon;
do $test$ begin
  if (select count(*) from public.ig_photo_tags where post_key='codex_ig_tags_rls_fixture')<>1 then raise exception 'anon cannot read'; end if;
  begin insert into public.ig_photo_tags(post_key,photo_key,handle,image_key,artist_ids) values ('codex_ig_tags_rls_fixture','anon','cortis','x.jpg',array['a0001']);raise exception 'anon insert allowed';exception when insufficient_privilege then null;end;
  begin update public.ig_photo_tags set artist_ids=array['a0002'] where post_key='codex_ig_tags_rls_fixture';raise exception 'anon update allowed';exception when insufficient_privilege then null;end;
  begin delete from public.ig_photo_tags where post_key='codex_ig_tags_rls_fixture';raise exception 'anon delete allowed';exception when insufficient_privilege then null;end;
end $test$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","email":"ig-tag-test@example.invalid","is_anonymous":false,"user_metadata":{"email":"bethej2love@gmail.com"}}',true);
do $test$ declare n integer;begin
  if (select count(*) from public.ig_photo_tags where post_key='codex_ig_tags_rls_fixture')<>1 then raise exception 'user cannot read'; end if;
  begin insert into public.ig_photo_tags(post_key,photo_key,handle,image_key,artist_ids) values ('codex_ig_tags_rls_fixture','user','cortis','x.jpg',array['a0001']);raise exception 'nonadmin insert allowed';exception when insufficient_privilege then null;end;
  update public.ig_photo_tags set artist_ids=array['a0002'] where post_key='codex_ig_tags_rls_fixture';get diagnostics n=row_count;if n<>0 then raise exception 'nonadmin update allowed';end if;
  delete from public.ig_photo_tags where post_key='codex_ig_tags_rls_fixture';get diagnostics n=row_count;if n<>0 then raise exception 'nonadmin delete allowed';end if;
end $test$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","email":"bethej2love@gmail.com","is_anonymous":true}',true);
do $test$ begin
  begin insert into public.ig_photo_tags(post_key,photo_key,handle,image_key,artist_ids) values ('codex_ig_tags_rls_fixture','anonymous-user','cortis','x.jpg',array['a0001']);raise exception 'anonymous user insert allowed';exception when insufficient_privilege then null;end;
end $test$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","email":"bethej2love@gmail.com","is_anonymous":false}',true);
do $test$ declare n integer;begin
  insert into public.ig_photo_tags(post_key,photo_key,handle,media_id,image_key,artist_ids) values ('codex_ig_tags_rls_fixture','id:654321','cortis','654321','y.jpg',array['a0001','a0002']);
  update public.ig_photo_tags set artist_ids=array['a0003'],revision=2 where post_key='codex_ig_tags_rls_fixture' and photo_key='id:654321' and revision=1;get diagnostics n=row_count;if n<>1 then raise exception 'admin update denied';end if;
  update public.ig_photo_tags set artist_ids=array['a0004'],revision=2 where post_key='codex_ig_tags_rls_fixture' and photo_key='id:654321' and revision=1;get diagnostics n=row_count;if n<>0 then raise exception 'stale revision overwrote tags';end if;
  begin update public.ig_photo_tags set artist_ids=array['<script>'] where post_key='codex_ig_tags_rls_fixture';raise exception 'invalid ID accepted';exception when check_violation then null;end;
  begin update public.ig_photo_tags set artist_ids=array[]::text[] where post_key='codex_ig_tags_rls_fixture';raise exception 'empty tag row accepted';exception when check_violation then null;end;
  delete from public.ig_photo_tags where post_key='codex_ig_tags_rls_fixture' and photo_key='id:654321' and revision=2;get diagnostics n=row_count;if n<>1 then raise exception 'admin delete denied';end if;
end $test$;
reset role;
rollback;
