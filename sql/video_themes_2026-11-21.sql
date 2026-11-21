-- 영상 테마 태그(#교복 #수트 #여름 …) 2단계 — 확인 태깅 (2026-11-21 준비, **미실행**)
-- 1단계(이미 배포): 검색이 제목 표기로 찾는다(app.js _NL_THEMES). 제목에 안 적힌 영상은 빠진다.
-- 2단계(이 파일): 영상에 themes 열을 두고 **사람이 확인한 것만** 붙인다. 순서 —
--   ① 아래 열·인덱스 추가 ② 어드민에 '테마 후보' 목록(제목에 테마 낱말이 든 영상, 테마별) + 확인 버튼 ③ 앱 검색은 themes 열이 있으면 열 우선, 없으면 제목.
-- ⚠️ 조건식 하나로 한꺼번에 채우지 않는다(CLAUDE.md 영상 태깅 규칙 — 500건 넘으면 표본 확인). 제목 낱말은 후보일 뿐이다:
--    '여름'은 곡명(여름 안에서)·'겨울'은 멤버 이름(에스파 윈터 아님, 가수 겨울)에도 걸린다.

alter table public.yt_channel_videos add column if not exists themes text[];
create index if not exists ytv_themes_gin on public.yt_channel_videos using gin (themes) where themes is not null;

-- 후보 보기(예: 교복) — 그룹 하나씩, 가볍게. 전체 훑기 금지.
-- select id, title from public.yt_channel_videos where group_ko = '아이브' and title_norm ilike '%교복%' and themes is null order by view_count desc nulls last limit 50;
-- 확인한 영상에 붙이기(예):
-- update public.yt_channel_videos set themes = array(select distinct unnest(coalesce(themes,'{}') || array['uniform'])) where id in ('…','…');

-- 되돌리기: drop index if exists public.ytv_themes_gin; alter table public.yt_channel_videos drop column if exists themes;
