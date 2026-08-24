-- 흔적(이번 주 하트+리액션) 익명 합산 RPC — 2026-08-24
-- 상태줄 "이번 주 N명이 흔적 M개를 남겼어요" (순위·개인귀속 없이 총량만).
--   N = 최근 7일간 이 그룹(멤버) 영상에 하트(video_scraps) 또는 리액션(video_reactions)을 남긴
--       서로 다른 사용자 수, M = 그 흔적(하트+리액션) 총개수.
-- 흔적 테이블엔 group_ko가 없고 video_url만 있어, URL에서 유튜브 id를 뽑아 yt_channel_videos.id로
-- 조인한다. favcount RPC(get_group_fav_count 등)와 같은 패턴.
-- 프론트(index.html _showTraceCount)는 json {n, m} 을 기대함.

-- ── 1) 흔적 테이블에 created_at 보장 ────────────────────────────────────────────
-- 클라 insert가 created_at을 안 써서, 없으면 추가한다. nullable + default now() 로 두면
-- 기존 행은 NULL → 7일 윈도우에서 자동 제외되어(과거 누적이 이번 주로 뻥튀기되지 않음) 지금부터
-- 깨끗이 쌓인다. 이미 컬럼이 있으면(값 존재) if not exists 로 건너뛰고 실제 값이 그대로 쓰인다.
alter table video_scraps    add column if not exists created_at timestamptz default now();
alter table video_reactions add column if not exists created_at timestamptz default now();

-- (선택) 주간 필터 성능용 인덱스 — 흔적이 많아지면 도움. 없어도 동작함.
create index if not exists video_scraps_created_at_idx    on video_scraps    (created_at);
create index if not exists video_reactions_created_at_idx on video_reactions (created_at);

-- ── URL → 유튜브 video id 추출 헬퍼 ─────────────────────────────────────────────
-- watch?v=ID(&...) 와 shorts/ID(?...) 두 형태 지원.
create or replace function _yt_id_from_url(u text)
returns text language sql immutable as $$
  select case
    when u ~ 'v='      then split_part(split_part(u, 'v=', 2), '&', 1)
    when u ~ 'shorts/' then split_part(split_part(u, 'shorts/', 2), '?', 1)
    else null
  end;
$$;

-- ── 2) 그룹 흔적(이번 주) ───────────────────────────────────────────────────────
create or replace function get_group_trace_week(p_group_ko text)
returns json language sql stable security definer set search_path = public as $$
  with vids as (
    select id from yt_channel_videos where group_ko = p_group_ko
  ),
  t as (
    select s.user_id
      from video_scraps s
     where s.created_at >= now() - interval '7 days'
       and _yt_id_from_url(s.video_url) in (select id from vids)
    union all
    select r.user_id
      from video_reactions r
     where r.created_at >= now() - interval '7 days'
       and _yt_id_from_url(r.video_url) in (select id from vids)
  )
  select json_build_object(
    'n', (select count(distinct user_id) from t),
    'm', (select count(*) from t)
  );
$$;

-- ── 3) 멤버 흔적(이번 주) ───────────────────────────────────────────────────────
-- p_member_key = '그룹ko:멤버ko' (프론트: a.group.ko + ':' + a.name.ko).
-- ⚠️ members 컬럼이 text[] 라고 가정(@> 연산자). 만약 jsonb 라면 아래 주석의 형태로 바꿀 것.
create or replace function get_member_trace_week(p_member_key text)
returns json language sql stable security definer set search_path = public as $$
  with vids as (
    select id from yt_channel_videos
     where group_ko = split_part(p_member_key, ':', 1)
       and members @> array[split_part(p_member_key, ':', 2)]        -- text[] 인 경우
       -- jsonb 인 경우: and members @> to_jsonb(array[split_part(p_member_key, ':', 2)])
  ),
  t as (
    select s.user_id
      from video_scraps s
     where s.created_at >= now() - interval '7 days'
       and _yt_id_from_url(s.video_url) in (select id from vids)
    union all
    select r.user_id
      from video_reactions r
     where r.created_at >= now() - interval '7 days'
       and _yt_id_from_url(r.video_url) in (select id from vids)
  )
  select json_build_object(
    'n', (select count(distinct user_id) from t),
    'm', (select count(*) from t)
  );
$$;

-- ── 4) 클라(anon/authenticated)가 호출할 수 있게 실행 권한 ───────────────────────
grant execute on function get_group_trace_week(text)  to anon, authenticated;
grant execute on function get_member_trace_week(text) to anon, authenticated;
