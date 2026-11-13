-- 2026-11-13 Codex 11-12 검수 남은 개별 오귀속(KO1KEYZ 동명이인 9·CUTIE STREET 1·조합 페이지 영상 2). 전부 tags_manual=false(조건으로 다시 확인).
-- KO1KEYZ·CUTIE STREET는 미등록 그룹 → '무관'(드림캐쳐 ← 첫사랑 수아와 같은 처리). KO1KEYZ 시영(=미래소년 박시영)은 11-12에 박시영으로 옮겨 보존.
-- 되돌리기: sql/2026-11-13_codex_ko1keyz_chem_undo.sql (백업 표 _bak_codex_ko1keyz_20261113)
create table if not exists public._bak_codex_ko1keyz_20261113 as
  select id, group_ko, members, with_members, with_groups, content_flag from yt_channel_videos where id in
  ('E7FT8qkOPCM','-x9iCWCq88c','qOmqHXXx7zs','Olg9ulQBpS0','WQ38JRyQock','R03wYKYK4-Q','L3rurPMeM1s','JsLs-8igfFI','uioJzEcSVUc','ArJmURaeilo','T1Ta2k8uYrw','v_d38jgFQR0');
alter table public._bak_codex_ko1keyz_20261113 enable row level security;
-- KO1KEYZ 유라(아베 유라) → 걸스데이 유라 아님
update yt_channel_videos set content_flag='무관' where id in ('E7FT8qkOPCM','-x9iCWCq88c','qOmqHXXx7zs') and group_ko='걸스데이' and tags_manual is not true;
-- KO1KEYZ 유키(고토 유키) → 넥스지 유키·솔로 유키 아님
update yt_channel_videos set content_flag='무관' where id in ('Olg9ulQBpS0','WQ38JRyQock') and group_ko='넥스지' and tags_manual is not true;
update yt_channel_videos set content_flag='무관' where id='R03wYKYK4-Q' and group_ko='유키' and tags_manual is not true;
-- KO1KEYZ 토와(하마다 토와) → 아이덴티티 토와 아님
update yt_channel_videos set content_flag='무관' where id in ('L3rurPMeM1s','JsLs-8igfFI','uioJzEcSVUc') and group_ko='아이덴티티' and tags_manual is not true;
-- CUTIE STREET '동글동글 동글이'(SBS 인기가요 261025) → 올데이프로젝트 아님
update yt_channel_videos set content_flag='무관' where id='ArJmURaeilo' and group_ko='올데이프로젝트' and tags_manual is not true;
-- 조합 페이지: 준호 'Señorita' 개인 직캠(실제 듀엣은 윤아) — JUN.K 아님
update yt_channel_videos set members=array['준호'] where id='T1Ta2k8uYrw' and group_ko='2PM' and tags_manual is not true;
-- 조합 페이지: B.D.U 제이창 'My One' 개인 직캠 — 단체 4명 태그
update yt_channel_videos set members=array['제이 창'] where id='v_d38jgFQR0' and group_ko='B.D.U' and tags_manual is not true;
select id, group_ko, members, content_flag from yt_channel_videos where id in
  ('E7FT8qkOPCM','-x9iCWCq88c','qOmqHXXx7zs','Olg9ulQBpS0','WQ38JRyQock','R03wYKYK4-Q','L3rurPMeM1s','JsLs-8igfFI','uioJzEcSVUc','ArJmURaeilo','T1Ta2k8uYrw','v_d38jgFQR0');
