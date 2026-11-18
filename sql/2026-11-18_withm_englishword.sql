-- [실행됨 2026-11-18 Opus, 제목 전수 검토 후] 2026-11-18 Claude 검수 — 콜라보 태그(with_members) 오인 19건 (영어 낱말·타인 이름이 멤버 영문명과 겹침)
-- 크리스(Kris)←Chris Brown 댄스 커버·ON FILM 6 / 써머←#Summer_Time(에이핑크 Pink Drive in Tokyo) 2 / 소영←"so young & free" 2 / 유영←"YOUNG-LUV.COM" 1 / 장은성←STRAYCITY 공지 8(제목·설명 근거 없음, 설명란 확인 권장)
create table if not exists public.bak_20261118_withm2 as select id, group_ko, members, with_members, with_groups from yt_channel_videos where id in ('pJ1ZQJ7TVIo','Fj1vH2O_crc','LpfgW7V3-R0','vVazQcwgHG0','WZqMKqF29-Q','ciT9rPw2vdI','v9k7YDWzn1s','wEKUc1__DIw','cq8mIvQGKPs','F1O53Kt9I5w','BQL9yR6LDFo','6z9DZyXdw1U','matP32Sky08','hlEfHhqIK-Y','iKejxdXqOE8','0ONxtrsybIM','3OVspPZFLEo','zJHYto9IIfQ','hiw6W1hugQc');
alter table public.bak_20261118_withm2 enable row level security;
revoke all on public.bak_20261118_withm2 from anon, authenticated;
update yt_channel_videos set with_members=array_remove(with_members, '크리스(크리스)') where id in ('pJ1ZQJ7TVIo','Fj1vH2O_crc','LpfgW7V3-R0','vVazQcwgHG0','WZqMKqF29-Q','ciT9rPw2vdI') and '크리스(크리스)'=any(with_members) and tags_manual=false; -- 6건
update yt_channel_videos set with_members=array_remove(with_members, '써머(써머)') where id in ('v9k7YDWzn1s','wEKUc1__DIw') and '써머(써머)'=any(with_members) and tags_manual=false; -- 2건
update yt_channel_videos set with_members=array_remove(with_members, '소영(소영)') where id in ('cq8mIvQGKPs','F1O53Kt9I5w') and '소영(소영)'=any(with_members) and tags_manual=false; -- 2건
update yt_channel_videos set with_members=array_remove(with_members, '유영(유영)') where id in ('BQL9yR6LDFo') and '유영(유영)'=any(with_members) and tags_manual=false; -- 1건
update yt_channel_videos set with_members=array_remove(with_members, '장은성(장은성)') where id in ('6z9DZyXdw1U','matP32Sky08','hlEfHhqIK-Y','iKejxdXqOE8','0ONxtrsybIM','3OVspPZFLEo','zJHYto9IIfQ','hiw6W1hugQc') and '장은성(장은성)'=any(with_members) and tags_manual=false; -- 8건
select id, with_members from yt_channel_videos where id in ('pJ1ZQJ7TVIo','Fj1vH2O_crc','LpfgW7V3-R0','vVazQcwgHG0','WZqMKqF29-Q','ciT9rPw2vdI','v9k7YDWzn1s','wEKUc1__DIw','cq8mIvQGKPs','F1O53Kt9I5w','BQL9yR6LDFo','6z9DZyXdw1U','matP32Sky08','hlEfHhqIK-Y','iKejxdXqOE8','0ONxtrsybIM','3OVspPZFLEo','zJHYto9IIfQ','hiw6W1hugQc');
-- 되돌리기: update yt_channel_videos v set with_members=b.with_members, with_groups=b.with_groups from public.bak_20261118_withm2 b where v.id=b.id;
