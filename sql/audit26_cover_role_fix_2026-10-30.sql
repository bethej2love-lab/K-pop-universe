-- Codex 검수26차 후속(2026-10-30 Claude Code): 원곡↔실제 출연 역할 정정. 실제 출연자는 남기고 잘못 붙은 관계만 뗀다.
-- 각 줄은 현재값 가드(지금 저장된 잘못된 값일 때만 바뀜). 수동잠금(tags_manual) 행은 잠금 풀기→수정→다시 잠금(트리거가 잠긴 행의 태그 칸을 되돌림).
create table if not exists _bak_audit26_20261030 as
  select id,group_ko,members,with_members,with_groups,cover_of_members,cover_of_groups,cover_of_song,tags_manual,content_flag,flag_source,flagged_at
  from yt_channel_videos where id in (
    'WfkOdlW8Va4','nOnwBLSDS9w','dy84rKkxEG0','GgbjDi0gtBk','NiVRVDVhZbY','vnwE2jIPgWI','uk9rO3KQgco','ONyyfNq1UO8','Df1P2WiYSms','mi-Wj3jFLjg','sZV7NFhI0Q0',
    '7FoKicIz_Jc','m_Ns7lTLiS8','Jl2gXuWRJJU','jIwl9k4ZRmI','SHqot3nOYi0','SJbUq4RHXfM','nWsCYW4G9UI','pb1SbjOzifY','_Y3uhUBAcnI','gjSR9TgTzQE','V7oihd6y3dg',
    '0HSvBs73UXA','XAomU4u1BxE','xzd24Ik62E0','nocqSj3bnmQ','heItpRvGzVU',
    'eYmGDQ1VjU8','blsnUII2KD4','EL2lwHLePHc','-i5di_Tx7tM','R2HEJVwO0bE','jGvihirVVQg','x3e2e2IOhmI','edJxw9I8j5k','pKGw85EABAk','XQWhr4F9vbo','YzSVnaHz2r8','dp18Jb3cK8s','GIN6QFoGYCM','RnerBUsjaUM','_Pk6xfju3l0')
  or (group_ko='유스피어' and cover_of_groups @> array['스피드']);
alter table _bak_audit26_20261030 enable row level security;

-- ① 예성 'Floral Sense' 4건 — 에스파 윈터 주인 → 예성 본인(곡 크레딧 'Feat. 윈터'를 촬영대상으로 읽었다). 본인곡이라 원곡 칸 비움
update yt_channel_videos set group_ko='예성', members=array['예성'], with_members=array[]::text[], cover_of_members=array[]::text[], cover_of_groups=array[]::text[], cover_of_song=null
  where id in ('WfkOdlW8Va4','nOnwBLSDS9w','dy84rKkxEG0','GgbjDi0gtBk') and group_ko='에스파' and coalesce(tags_manual,false)=false;
-- ② 1theK 커버 3건 — 주인 = 실제 공연자, 원곡 그룹은 원곡 칸
update yt_channel_videos set group_ko='아이브', members=array['이서'], with_members=array[]::text[], with_groups=array[]::text[], cover_of_members=array[]::text[], cover_of_groups=array['방탄소년단','몬스타엑스']
  where id='NiVRVDVhZbY' and group_ko='방탄소년단' and coalesce(tags_manual,false)=false;
update yt_channel_videos set group_ko='스테이씨', members=array['세은'], with_members=array[]::text[], with_groups=array[]::text[], cover_of_members=array[]::text[], cover_of_groups=array['블랙핑크','세븐틴']
  where id='vnwE2jIPgWI' and group_ko='세븐틴' and coalesce(tags_manual,false)=false;
update yt_channel_videos set group_ko='원어스', members=array['환웅'], with_members=array[]::text[], with_groups=array[]::text[], cover_of_members=array[]::text[], cover_of_groups=array['에스파','엔시티 127']
  where id='uk9rO3KQgco' and group_ko='엔시티 127' and coalesce(tags_manual,false)=false;
-- ③ 원곡 피처링을 출연자로 — 출연(with)에서만 빼고 원곡 칸은 유지. 다원 VIBE 커버의 유태양(SF9)은 원곡 '태양' 오매칭
update yt_channel_videos set with_members=array[]::text[] where id='ONyyfNq1UO8' and with_members=array['지젤(에스파)'] and coalesce(tags_manual,false)=false;
update yt_channel_videos set members=array['다원'], with_members=array[]::text[] where id='Df1P2WiYSms' and members=array['다원','유태양'] and coalesce(tags_manual,false)=false;
update yt_channel_videos set with_members=array[]::text[] where id='mi-Wj3jFLjg' and with_members=array['도겸(세븐틴)'] and coalesce(tags_manual,false)=false;
update yt_channel_videos set with_members=array[]::text[] where id='sZV7NFhI0Q0' and with_members=array['태용(엔시티 127)'] and coalesce(tags_manual,false)=false;
-- ④ 엉뚱한 원곡 칸 정리
update yt_channel_videos set with_members=array[]::text[], cover_of_members=array[]::text[], cover_of_groups=array[]::text[], cover_of_song=null
  where id='7FoKicIz_Jc' and cover_of_song='Find (파인드)' and coalesce(tags_manual,false)=false;              -- 정은지 DND 자기곡 챌린지(브브걸 은지·SS501 아님)
update yt_channel_videos set cover_of_members=array[]::text[], cover_of_groups=array[]::text[], cover_of_song=null
  where id in ('m_Ns7lTLiS8','Jl2gXuWRJJU','gjSR9TgTzQE') and coalesce(tags_manual,false)=false;              -- BIG Naughty·Post Malone 원곡을 동명 K-pop곡으로 / seOul drift 'Speed up' 문구
update yt_channel_videos set cover_of_song='프락치' where id='jIwl9k4ZRmI' and cover_of_song='마크 (MARK)' and coalesce(tags_manual,false)=false;
-- ⑤ 출연자 정리
update yt_channel_videos set members=array['MJ','윤산하'] where id in ('SHqot3nOYi0','SJbUq4RHXfM') and members=array['MJ'] and coalesce(tags_manual,false)=false; -- Cover by MJ (Feat. 윤산하) — 같은 곡 쇼츠 NVH6R8APhQE와 같게
update yt_channel_videos set with_members=array[]::text[] where id='nWsCYW4G9UI' and coalesce(tags_manual,false)=false;  -- HANA JISOO/MOMOKA를 블랙핑크 지수·러블리즈 서지수·피프티 하나·신보라로
update yt_channel_videos set members=array['윤아'] where id='pb1SbjOzifY' and members=array['윤아','모카'] and coalesce(tags_manual,false)=false; -- MOMOKA(HANA)를 아일릿 모카로
update yt_channel_videos set members=array[]::text[] where members=array['모카'] and group_ko='아일릿' and coalesce(tags_manual,false)=false and id in (
  'eYmGDQ1VjU8','blsnUII2KD4','EL2lwHLePHc','-i5di_Tx7tM','R2HEJVwO0bE','jGvihirVVQg','x3e2e2IOhmI','edJxw9I8j5k','pKGw85EABAk','XQWhr4F9vbo','YzSVnaHz2r8','dp18Jb3cK8s','GIN6QFoGYCM','RnerBUsjaUM','_Pk6xfju3l0'); -- 단체 MV·안무·무대·비하인드(ykJ2xlYdCBQ 'MOKA & JISOO'는 유지)
-- ⑥ 수동잠금 행 — 잠금 풀기 → 원곡 칸만 정리 → 다시 잠금
update yt_channel_videos set tags_manual=false where id in ('_Y3uhUBAcnI','V7oihd6y3dg') and tags_manual=true;
update yt_channel_videos set tags_manual=false where group_ko='유스피어' and cover_of_groups @> array['스피드'] and tags_manual=true;
update yt_channel_videos set cover_of_members=array[]::text[] where id='_Y3uhUBAcnI' and cover_of_members=array['키(샤이니)'];        -- IVE 자기곡 Baddie 챌린지(키는 게스트로만)
update yt_channel_videos set cover_of_members=array[]::text[] where id='V7oihd6y3dg' and cover_of_groups=array['아이들'];             -- 원곡은 (여자)아이들 — 공연자 수윤·지한을 원곡자로
update yt_channel_videos set cover_of_members=array[]::text[], cover_of_groups=array[]::text[], cover_of_song=null
  where group_ko='유스피어' and cover_of_groups @> array['스피드'];                                                          -- 본인곡 SPEED_ZONE/ZOOM — 협업 상대(with)는 유지
update yt_channel_videos v set tags_manual=true from _bak_audit26_20261030 b where v.id=b.id and b.tags_manual=true;
-- ⑦ 원본이 비공개인 영상 5건 숨김(Codex 원본 확인: '비공개 동영상입니다')
update yt_channel_videos set content_flag='hidden', flag_source='manual', flagged_at=now()
  where id in ('0HSvBs73UXA','XAomU4u1BxE','xzd24Ik62E0','nocqSj3bnmQ','heItpRvGzVU') and content_flag is null;

select id,group_ko,members,with_members,cover_of_members,cover_of_groups,cover_of_song,tags_manual,content_flag from yt_channel_videos v
  where exists (select 1 from _bak_audit26_20261030 b where b.id=v.id) order by group_ko,id;
