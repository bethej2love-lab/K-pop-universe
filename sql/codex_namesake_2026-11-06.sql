-- Audited official lead performers; reruns require a fresh snapshot.
BEGIN;
DO $audit$
DECLARE p jsonb; current_row public.yt_channel_videos%ROWTYPE; next_row public.yt_channel_videos%ROWTYPE;
BEGIN
 FOR p IN SELECT value FROM jsonb_array_elements($plan$[{"before":{"id":"KaWiUJigSbM","title":"[C.C.] A big match of JAY PARK & former MMA fighter JUNG CHANSUNG #JAYPARK #KOREANZOMBIE","description":"#MBCWORLD #JAYPARK #JUNG_CHANSUNG #KOREANZOMBIE #Reveal_My_Star's_Life_The_Manager #EP274\n-\n각국어 번역 자막 제작: 컨텐츠 제작의 마무리는 컨텐츠플라이! 글로벌 진출을 위한 최고의 파트너, CONTENTSFLY에서 제작되었습니다\nhttps://www.contentsfly.com","published_at":"2023-11-27","group_ko":"2PM","members":["찬성"],"with_groups":[],"with_members":[],"cover_of_groups":[],"cover_of_members":[],"source_handle":"MBC_WORLD","tags_manual":false,"content_flag":null},"after":{"id":"KaWiUJigSbM","title":"[C.C.] A big match of JAY PARK & former MMA fighter JUNG CHANSUNG #JAYPARK #KOREANZOMBIE","description":"#MBCWORLD #JAYPARK #JUNG_CHANSUNG #KOREANZOMBIE #Reveal_My_Star's_Life_The_Manager #EP274\n-\n각국어 번역 자막 제작: 컨텐츠 제작의 마무리는 컨텐츠플라이! 글로벌 진출을 위한 최고의 파트너, CONTENTSFLY에서 제작되었습니다\nhttps://www.contentsfly.com","published_at":"2023-11-27","group_ko":"박재범","members":["박재범"],"with_groups":[],"with_members":[],"cover_of_groups":[],"cover_of_members":[],"source_handle":"MBC_WORLD","tags_manual":true,"content_flag":null}},{"before":{"id":"QIQl3MrERw0","title":"하루하루 - 정찬성 X 박재범 [더 시즌즈-박재범의 드라이브] | KBS 230423 방송","description":"하루하루 - 정찬성 X 박재범 #더시즌즈 #박재범 #정찬성 #하루하루 #음악 #뮤직 #드라이브 #토크쇼 #박재범의드라이브 ...","published_at":"2023-04-23","group_ko":"2PM","members":["찬성"],"with_groups":[],"with_members":[],"cover_of_groups":[],"cover_of_members":[],"source_handle":null,"tags_manual":false,"content_flag":null},"after":{"id":"QIQl3MrERw0","title":"하루하루 - 정찬성 X 박재범 [더 시즌즈-박재범의 드라이브] | KBS 230423 방송","description":"하루하루 - 정찬성 X 박재범 #더시즌즈 #박재범 #정찬성 #하루하루 #음악 #뮤직 #드라이브 #토크쇼 #박재범의드라이브 ...","published_at":"2023-04-23","group_ko":"박재범","members":["박재범"],"with_groups":[],"with_members":[],"cover_of_groups":[],"cover_of_members":[],"source_handle":null,"tags_manual":true,"content_flag":null}}]$plan$::jsonb)
 LOOP
  SELECT * INTO current_row FROM public.yt_channel_videos WHERE id=p->'before'->>'id' FOR UPDATE;
  IF NOT FOUND OR EXISTS (SELECT 1 FROM jsonb_each(p->'before') e WHERE (to_jsonb(current_row)->e.key) IS DISTINCT FROM e.value) THEN
   RAISE EXCEPTION 'Snapshot mismatch for %; no changes applied',p->'before'->>'id';
  END IF;
  next_row:=jsonb_populate_record(NULL::public.yt_channel_videos,p->'after');
  UPDATE public.yt_channel_videos SET group_ko=next_row.group_ko,members=next_row.members,
   cover_of_groups=next_row.cover_of_groups,cover_of_members=next_row.cover_of_members,tags_manual=next_row.tags_manual
   WHERE id=current_row.id;
 END LOOP;
END $audit$;
COMMIT;
