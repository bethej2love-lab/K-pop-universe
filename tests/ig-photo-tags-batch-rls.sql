-- Run against the new RPC; every fixture and mutation is rolled back.
begin;
insert into public.ig_photo_tags(post_key,photo_key,handle,image_key,artist_ids)
values ('codex_ig_batch_other','keep','cortis','keep.jpg',array['a0001']);
set local role anon;
do $test$ begin
  begin perform public.ig_photo_tags_apply_post('codex_ig_batch','cortis','[]',array['a0001']);raise exception 'anon RPC allowed';exception when insufficient_privilege then null;end;
end $test$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","email":"user@example.invalid","is_anonymous":false,"user_metadata":{"email":"bethej2love@gmail.com"}}',true);
do $test$ begin
  begin perform public.ig_photo_tags_apply_post('codex_ig_batch','cortis','[]',array['a0001']);raise exception 'nonadmin RPC allowed';exception when insufficient_privilege then null;end;
end $test$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","email":"bethej2love@gmail.com","is_anonymous":true}',true);
do $test$ begin
  begin perform public.ig_photo_tags_apply_post('codex_ig_batch','cortis','[]',array['a0001']);raise exception 'anonymous admin RPC allowed';exception when insufficient_privilege then null;end;
end $test$;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000001","role":"authenticated","email":"bethej2love@gmail.com","is_anonymous":false}',true);
do $test$ declare payload jsonb; n integer; snapshot jsonb; begin
  select jsonb_agg(jsonb_build_object('photo_key','id:'||(123450+i)::text,'media_id',(123450+i)::text,'image_key',i||'.jpg','expected_revision',null)) into payload from generate_series(1,20) i;
  select count(*) into n from public.ig_photo_tags_apply_post('codex_ig_batch','cortis',payload,array['a0001','a0002']);
  if n<>20 then raise exception '20-photo create failed';end if;
  update public.ig_photo_tags set artist_ids=array['a0003'],revision=revision+1 where post_key='codex_ig_batch' and photo_key='id:123451';
  if (select count(*) from public.ig_photo_tags where post_key='codex_ig_batch' and artist_ids=array['a0001','a0002'])<>19 then raise exception 'per-photo edit changed siblings';end if;
  select jsonb_agg(jsonb_build_object('photo_key',photo_key,'media_id',media_id,'image_key',image_key,'expected_revision',revision)) into payload from public.ig_photo_tags where post_key='codex_ig_batch';
  perform public.ig_photo_tags_apply_post('codex_ig_batch','cortis',payload,array['a0004']);
  if (select count(*) from public.ig_photo_tags where post_key='codex_ig_batch' and artist_ids=array['a0004'])<>20 then raise exception 'bulk overwrite failed';end if;
  select jsonb_agg(to_jsonb(t) order by photo_key) into snapshot from public.ig_photo_tags t where post_key='codex_ig_batch';
  begin
    perform public.ig_photo_tags_apply_post('codex_ig_batch','cortis','[{"photo_key":"00new","image_key":"new.jpg"},{"photo_key":"id:123470","image_key":"20.jpg","expected_revision":999}]',array['a0005']);
    raise exception 'stale batch accepted';
  exception when serialization_failure then null;end;
  if snapshot is distinct from (select jsonb_agg(to_jsonb(t) order by photo_key) from public.ig_photo_tags t where post_key='codex_ig_batch') then raise exception 'conflict partially wrote photos';end if;
  begin
    perform public.ig_photo_tags_apply_post('codex_ig_batch','cortis','[{"photo_key":"00new","image_key":"new.jpg"},{"photo_key":"zzbad","image_key":""}]',array['a0005']);
    raise exception 'invalid photo accepted';
  exception when invalid_parameter_value then null;end;
  if snapshot is distinct from (select jsonb_agg(to_jsonb(t) order by photo_key) from public.ig_photo_tags t where post_key='codex_ig_batch') then raise exception 'invalid batch partially wrote photos';end if;
  begin perform public.ig_photo_tags_apply_post('codex_ig_batch','cortis','[{"photo_key":"same","image_key":"a.jpg"},{"photo_key":"same","image_key":"b.jpg"}]',array['a0001']);raise exception 'duplicate accepted';exception when invalid_parameter_value then null;end;
  begin perform public.ig_photo_tags_apply_post('codex_ig_batch','cortis','[]',array['a0001']);raise exception 'empty photos accepted';exception when invalid_parameter_value then null;end;
  select jsonb_agg(jsonb_build_object('photo_key',i::text,'image_key','x.jpg')) into payload from generate_series(1,21) i;
  begin perform public.ig_photo_tags_apply_post('codex_ig_batch','cortis',payload,array['a0001']);raise exception '21 photos accepted';exception when invalid_parameter_value then null;end;
  select jsonb_agg(jsonb_build_object('photo_key',photo_key,'media_id',media_id,'image_key',image_key,'expected_revision',revision)) into payload from public.ig_photo_tags where post_key='codex_ig_batch';
  insert into public.ig_photo_tags(post_key,photo_key,handle,image_key,artist_ids) values ('codex_ig_batch','not-visible','cortis','old.jpg',array['a0001']);
  perform public.ig_photo_tags_apply_post('codex_ig_batch','cortis',payload,array[]::text[]);
  if (select count(*) from public.ig_photo_tags where post_key='codex_ig_batch')<>1 then raise exception 'bulk clear touched non-target photo';end if;
  if (select count(*) from public.ig_photo_tags where post_key='codex_ig_batch_other')<>1 then raise exception 'other post changed';end if;
end $test$;
reset role;
rollback;
