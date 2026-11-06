-- One request/transaction for all currently displayed photos of a single post.
-- Keep existing RLS and optimistic revisions; never run as the function owner.
create or replace function public.ig_photo_tags_apply_post(
  p_post_key text, p_handle text, p_photos jsonb, p_artist_ids text[]
) returns setof public.ig_photo_tags
language plpgsql security invoker set search_path = '' as $$
declare
  photo record;
  prior public.ig_photo_tags%rowtype;
begin
  if auth.uid() is null or coalesce(auth.jwt()->>'email','') <> 'bethej2love@gmail.com'
    or coalesce(auth.jwt()->>'is_anonymous','false') <> 'false' then
    raise insufficient_privilege using message = 'Admin required';
  end if;
  if p_post_key is null or p_post_key !~ '^[A-Za-z0-9_-]{1,64}$'
    or p_handle is null or p_handle !~ '^[a-z0-9_.]{1,30}$'
    or p_artist_ids is null or cardinality(p_artist_ids) > 50
    or array_position(p_artist_ids,null) is not null
    or (cardinality(p_artist_ids)>0 and array_to_string(p_artist_ids,',') !~ '^a[0-9]{4,}(,a[0-9]{4,})*$') then
    raise invalid_parameter_value using message = 'Invalid post or members';
  end if;
  if p_photos is null or jsonb_typeof(p_photos) <> 'array' then
    raise invalid_parameter_value using message = 'Invalid photos';
  end if;
  if jsonb_array_length(p_photos) not between 1 and 20 then
    raise invalid_parameter_value using message = 'Expected 1 to 20 photos';
  end if;
  if (select count(distinct v->>'photo_key') from jsonb_array_elements(p_photos) v) <> jsonb_array_length(p_photos) then
    raise invalid_parameter_value using message = 'Duplicate or missing photo key';
  end if;
  for photo in select * from jsonb_to_recordset(p_photos) as x(
    photo_key text, media_id text, image_key text, expected_revision bigint
  ) order by photo_key loop
    if photo.photo_key is null or length(photo.photo_key) not between 1 and 300
      or photo.image_key is null or length(photo.image_key) not between 1 and 240
      or (photo.media_id is not null and photo.media_id !~ '^[0-9]{1,64}$')
      or (photo.expected_revision is not null and photo.expected_revision < 1) then
      raise invalid_parameter_value using message = 'Invalid photo identity';
    end if;
    select * into prior from public.ig_photo_tags t
      where t.post_key=p_post_key and t.photo_key=photo.photo_key for update;
    if found then
      if photo.expected_revision is distinct from prior.revision then
        raise sqlstate '40001' using message = 'tag revision conflict';
      end if;
      if cardinality(p_artist_ids)=0 then
        delete from public.ig_photo_tags t where t.post_key=p_post_key and t.photo_key=photo.photo_key;
      else
        update public.ig_photo_tags t set handle=p_handle,
          media_id=coalesce(photo.media_id,prior.media_id),image_key=photo.image_key,
          artist_ids=p_artist_ids,revision=prior.revision+1
          where t.post_key=p_post_key and t.photo_key=photo.photo_key;
      end if;
    else
      if photo.expected_revision is not null then
        raise sqlstate '40001' using message = 'tag revision conflict';
      end if;
      if cardinality(p_artist_ids)>0 then
        insert into public.ig_photo_tags(post_key,photo_key,handle,media_id,image_key,artist_ids)
          values(p_post_key,photo.photo_key,p_handle,photo.media_id,photo.image_key,p_artist_ids);
      end if;
    end if;
  end loop;
  return query select t.* from public.ig_photo_tags t where t.post_key=p_post_key order by t.photo_key;
exception when unique_violation then
  raise sqlstate '40001' using message = 'tag revision conflict';
end;
$$;
revoke all on function public.ig_photo_tags_apply_post(text,text,jsonb,text[]) from public,anon,authenticated,service_role;
grant execute on function public.ig_photo_tags_apply_post(text,text,jsonb,text[]) to authenticated;
notify pgrst,'reload schema';
