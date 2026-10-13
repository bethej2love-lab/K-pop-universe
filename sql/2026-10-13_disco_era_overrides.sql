-- 디스코 활동기 수동 지정(어드민) — 자동 묶음(_discogEras)이 놓친 드문 경우만 덮어쓴다.
-- owner: 'g:그룹' | 'a:이름|그룹'  ·  album_id: '발매일|제목'  ·  target_id: '' = 강제 단독, 아니면 붙일 앨범 album_id
create table if not exists public.disco_era_overrides(
  owner text not null,
  album_id text not null,
  target_id text not null default '',
  updated_at timestamptz not null default now(),
  primary key(owner, album_id)
);
alter table public.disco_era_overrides enable row level security;
drop policy if exists dero_read on public.disco_era_overrides;
create policy dero_read on public.disco_era_overrides for select to anon, authenticated using (true);
drop policy if exists dero_admin_write on public.disco_era_overrides;
create policy dero_admin_write on public.disco_era_overrides for all to authenticated
  using ((auth.jwt()->>'email') = 'bethej2love@gmail.com')
  with check ((auth.jwt()->>'email') = 'bethej2love@gmail.com');
grant select on public.disco_era_overrides to anon, authenticated;
grant insert, update, delete on public.disco_era_overrides to authenticated;
