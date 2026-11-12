-- 2026-11-12 Codex 검수 후속 — 대표 영상
-- ① 퍼가기 막힌 영상 표식: 재생창이 유튜브 오류 101·150(소유자가 외부 사이트 재생 막음)을 받으면 report_embed_blocked로 시각을 찍는다.
--    카드 맨 위 대표 후보에서 뒤로 보낼 뿐, 목록·검색엔 그대로(원본은 유튜브에서 정상). 180일 지나면 앱이 표식을 무시한다.
alter table yt_channel_videos add column if not exists embed_blocked_at timestamptz;

create or replace function report_embed_blocked(p_id text, p_code int)
returns void language sql security definer set search_path = public as $$
  update yt_channel_videos set embed_blocked_at = now()
   where id = p_id and p_code in (101, 150)
     and (embed_blocked_at is null or embed_blocked_at < now() - interval '30 days');
$$;
revoke all on function report_embed_blocked(text, int) from public;
grant execute on function report_embed_blocked(text, int) to anon, authenticated;

-- Codex가 실제로 막힘을 확인한 대표 3개(소녀시대 Lion Heart·달샤벳 JOKER·헬로비너스 위글위글 — 모두 SBS 인기가요)
update yt_channel_videos set embed_blocked_at = now() where id in ('a3ZwmFvB_9U','x-j_4z1uGtw','nGLGeuNi_aE');

-- ② 그룹 활동 뒤 솔로 영상이 옛 그룹 이름으로 들어가 있던 4개 → 본인 솔로 키(같은 사람 기존 솔로 영상과 같은 형식: group_ko=이름, members={이름})
--    uoZKR8vA1xE 현아 'I'm Not Cool'(2021 P NATION) · POFSaR1v0wc 박진영 'When We Disco' 듀엣 선미(박진영은 미등록) ·
--    XddimyWY6Gg 한승우 'Dive Into'(2023 솔로) · w1K2ZcqHqTU KO1KEYZ 시영 = 미래소년 박시영(개명 박해곤→박시영, KO1KEYZ 미등록)
--    모두 tags_manual=false. 백업 후 수정.
create table if not exists _bak_hero_solo_20261112 as
  select id, group_ko, members, with_members, with_groups, song_keys from yt_channel_videos
   where id in ('uoZKR8vA1xE','POFSaR1v0wc','XddimyWY6Gg','w1K2ZcqHqTU');
update yt_channel_videos set group_ko='현아',   members='{현아}',   with_members='{}' where id='uoZKR8vA1xE' and tags_manual is not true;
update yt_channel_videos set group_ko='선미',   members='{선미}',   with_members='{}' where id='POFSaR1v0wc' and tags_manual is not true;
update yt_channel_videos set group_ko='한승우', members='{한승우}', with_members='{}' where id='XddimyWY6Gg' and tags_manual is not true;
update yt_channel_videos set group_ko='박시영', members='{박시영}', with_members='{}' where id='w1K2ZcqHqTU' and tags_manual is not true;

select id, group_ko, members, with_members, embed_blocked_at from yt_channel_videos
 where id in ('uoZKR8vA1xE','POFSaR1v0wc','XddimyWY6Gg','w1K2ZcqHqTU','a3ZwmFvB_9U','x-j_4z1uGtw','nGLGeuNi_aE');
