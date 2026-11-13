-- 인스타 게시물 누적 저장(2026-11-13, 사용자 "태깅한 사진도 날아갔나? 전체 게시물 보고 싶다").
-- 예전: ig_accounts.media를 매 수집마다 최신 몇 개로 덮어써서 지난 게시물(태깅한 사진 포함)이 카드에서 사라졌다.
-- 이제: 받은 게시물은 전부 여기에 쌓고(덮어쓰지 않음), 과거 게시물은 남는 호출로 페이지를 넘겨 채운다(ig_accounts.bf_*).
-- 사진 주소(u·c)는 4~5일이면 만료(oe=)되므로 화면은 만료된 글을 게시물 코드(post_key)로 다시 띄운다.
create table if not exists public.ig_media (
  post_key   text primary key,            -- instagram.com/p/{post_key}/ (reel·tv도 같은 코드 체계)
  handle     text not null,
  media_id   text,
  t          timestamptz,
  ty         text,                        -- IMAGE · VIDEO · CAROUSEL_ALBUM
  p          text,                        -- permalink
  u          text,                        -- 마지막으로 받은 대표 사진 주소(만료될 수 있음)
  c          jsonb,                       -- 캐러셀 사진 주소들(최근 수집분만, 만료될 수 있음)
  mi         jsonb,                       -- 캐러셀 사진별 id·종류(태그 식별용)
  n          int,                         -- 사진 장수(캐러셀)
  cap        text,                        -- 본문 앞부분
  lk         int,
  cm         int,
  m          text[],                      -- 매거진 계정: 본문에 태그된 우리 아이돌 핸들
  src        text,                        -- 'recent'(최신 수집) · 'backfill'(과거 채우기)
  seen_at    timestamptz not null default now()
);
create index if not exists ig_media_handle_t on public.ig_media (handle, t desc);
create index if not exists ig_media_m on public.ig_media using gin (m) where m is not null;
alter table public.ig_media enable row level security;
drop policy if exists ig_media_read on public.ig_media;
create policy ig_media_read on public.ig_media for select to anon, authenticated using (true);
grant select on public.ig_media to anon, authenticated;

-- 과거 채우기 진행 상태(계정별 다음 페이지 커서·끝났는지)
alter table public.ig_accounts add column if not exists bf_cursor text;
alter table public.ig_accounts add column if not exists bf_done boolean not null default false;
alter table public.ig_accounts add column if not exists bf_count int not null default 0;

-- 지금 ig_accounts.media에 있는 게시물부터 옮겨 둔다(지금 보이는 것이 다음 덮어쓰기로 사라지지 않게)
insert into public.ig_media (post_key, handle, media_id, t, ty, p, u, c, mi, n, cap, lk, cm, m, src)
select substring(e->>'p' from 'instagram\.com/(?:p|reel|tv)/([A-Za-z0-9_-]+)'), a.handle, e->>'id', (e->>'t')::timestamptz, e->>'ty', e->>'p', e->>'u',
       e->'c', e->'mi', coalesce(jsonb_array_length(case when jsonb_typeof(e->'c')='array' then e->'c' end), 1), left(e->>'cap', 2200),
       nullif(e->>'lk','')::int, nullif(e->>'cm','')::int,
       case when jsonb_typeof(e->'m')='array' then array(select jsonb_array_elements_text(e->'m')) end, 'recent'
from public.ig_accounts a, jsonb_array_elements(case when jsonb_typeof(a.media)='array' then a.media else '[]'::jsonb end) e
where substring(e->>'p' from 'instagram\.com/(?:p|reel|tv)/([A-Za-z0-9_-]+)') is not null
on conflict (post_key) do nothing;

select count(*) rows, count(distinct handle) handles, pg_size_pretty(pg_total_relation_size('public.ig_media')) size from public.ig_media;
