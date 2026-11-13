-- 2026-11-13 Codex 11-13 검수: 음방 회차의 동명이인·촬영 대상 뒤바뀜·단체 무대가 멤버로(29영상 중 확정분). 전부 tags_manual=false(조건으로 다시 확인).
-- 미등록 인물(리코브 니나·후지모토 아야카·MMZ 모모·윤서빈·YUHZ 준성·엔탑 강현·2Z 정현) → '무관'. 등록 인물은 실제 주인으로.
-- 되돌리기: sql/2026-11-13_codex_show_namesakes_undo.sql (백업 _bak_codex_show_20261113)
create table if not exists public._bak_codex_show_20261113 as
  select id, group_ko, members, with_members, with_groups, content_flag from yt_channel_videos where id in
  ('ALs2GstZIV0','sqYNffhzOnU','c5PKge1z5T0','5gfakT6Cd2I','W42z6KvoCj0','kG-VuJEZEnQ','p5acB_d9HoI','0aqcBjr4X48','KFYAz7JoeCE',
   'mqPP5pSigj4','BKE5mwVGwSw','w8Tc0dCAfys','TCTG60KPZ0E','_IrEFslQiaE','fjHqoFG7fr8','9pYHmg-WVXY','Zh-0xPeCipo','DM309A5cbmE',
   'w69uxP618Fg','POaxn5VuoDw','tX2gYSgGLUY','FLQgxyr0AGA','0XIJjGwIPMI','UF5JiJHCPQE','67s7Xi5bKEw','eq7Y0aD5AFE');
alter table public._bak_codex_show_20261113 enable row level security;
-- 리코브 솔로 니나 'Why' 6 → NiziU 니나 아님
update yt_channel_videos set content_flag='무관' where id in ('ALs2GstZIV0','sqYNffhzOnU','c5PKge1z5T0','5gfakT6Cd2I','W42z6KvoCj0','kG-VuJEZEnQ') and group_ko='니쥬' and tags_manual is not true;
-- 후지모토 아야카 'KIRAKIRA' 3 → NiziU 아야카 아님
update yt_channel_videos set content_flag='무관' where id in ('p5acB_d9HoI','0aqcBjr4X48','KFYAz7JoeCE') and group_ko='니쥬' and tags_manual is not true;
-- 러블리즈 Kei 솔로 '투비(鬪悲)' 4 → &TEAM K 아님, 러블리즈 Kei
update yt_channel_videos set group_ko='러블리즈', members=array['Kei'] where id in ('mqPP5pSigj4','BKE5mwVGwSw','w8Tc0dCAfys','TCTG60KPZ0E') and group_ko='앤팀' and tags_manual is not true;
-- 쇼케이팝 미등록 동명이인
update yt_channel_videos set content_flag='무관' where id='_IrEFslQiaE' and group_ko='트와이스' and tags_manual is not true;   -- MMZ 다카하나 모모
update yt_channel_videos set content_flag='무관' where id='fjHqoFG7fr8' and group_ko='퀸즈아이' and tags_manual is not true;   -- 윤서빈
update yt_channel_videos set content_flag='무관' where id='9pYHmg-WVXY' and group_ko='고스트나인' and tags_manual is not true; -- YUHZ 준성
update yt_channel_videos set content_flag='무관' where id in ('Zh-0xPeCipo','DM309A5cbmE') and group_ko='원위' and tags_manual is not true; -- 엔탑 강현
update yt_channel_videos set content_flag='무관' where id='w69uxP618Fg' and group_ko='이븐' and tags_manual is not true;        -- 2Z 정현
-- 하츠웨이브 리안 'ALIVE (Feat. 성찬 of RIIZE)' 직캠 — 촬영 대상은 리안(성찬은 원곡 피처링)
update yt_channel_videos set group_ko='하츠웨이브', members=array['리안'], with_members='{}' where id='POaxn5VuoDw' and group_ko='라이즈' and tags_manual is not true;
-- 음악중심 MC 규빈 X 도훈 '굿바이': 개인 직캠 둘이 서로 뒤바뀜, 풀캠은 두 사람
update yt_channel_videos set group_ko='도훈', members=array['도훈'] where id='tX2gYSgGLUY' and group_ko='김규빈' and tags_manual is not true;
update yt_channel_videos set group_ko='김규빈', members=array['김규빈'] where id='FLQgxyr0AGA' and group_ko='도훈' and tags_manual is not true;
update yt_channel_videos set with_groups=array['도훈'] where id='0XIJjGwIPMI' and group_ko='김규빈' and tags_manual is not true;
-- 단체 무대가 멤버 한 명으로
update yt_channel_videos set members='{}' where id='UF5JiJHCPQE' and group_ko='올아워즈' and tags_manual is not true;
update yt_channel_videos set members='{}' where id='67s7Xi5bKEw' and group_ko='하츠투하츠' and tags_manual is not true;
-- 더쇼 전체 생방송(여러 팀) → 피원하모니 단독 무대 아님
update yt_channel_videos set content_flag='무관' where id='eq7Y0aD5AFE' and group_ko='피원하모니' and tags_manual is not true;
select id, group_ko, members, with_groups, content_flag from yt_channel_videos where id in (select id from public._bak_codex_show_20261113) order by group_ko;
