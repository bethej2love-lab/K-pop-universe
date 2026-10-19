-- 인스타 공식 계정 정보(Business Discovery) 저장 테이블 (2026-10-19)
-- tools/ig_business_discovery.mjs(ig-stats.yml, 2시간마다)가 service_role로 쓰고, 앱은 anon으로 읽기만 한다.
create table if not exists public.ig_accounts (
  handle      text primary key,          -- 인스타 핸들(소문자) — artists/groups의 links.instagram에서 뽑은 것
  ig_id       text,
  name        text,
  followers   bigint,
  media_count integer,
  pic_url     text,                      -- fbcdn 주소, 며칠 뒤 만료(매일 새로 받음)
  media       jsonb,                     -- 최근 게시물 최대 6개 [{u 썸네일, p 원본 링크, t 시각, ty 종류}]
  status      text,                      -- ok | not_found(개인 계정·없는 계정·연령 제한)
  note        text,
  fetched_at  timestamptz default now()
);
alter table public.ig_accounts add column if not exists media jsonb;
create table if not exists public.ig_follower_daily (
  handle    text not null,
  day       date not null,               -- KST 날짜
  followers bigint not null,
  primary key (handle, day)
);
alter table public.ig_accounts enable row level security;
alter table public.ig_follower_daily enable row level security;
drop policy if exists "ig_accounts read" on public.ig_accounts;
create policy "ig_accounts read" on public.ig_accounts for select using (true);
drop policy if exists "ig_follower_daily read" on public.ig_follower_daily;
create policy "ig_follower_daily read" on public.ig_follower_daily for select using (true);
