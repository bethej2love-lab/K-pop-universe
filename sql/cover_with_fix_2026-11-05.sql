-- 커버를 '함께 나온 그룹'(with_groups)으로 붙인 행 정정 (2026-11-05) — 54행
-- 사용자 제보: 즐겨찾기 안 한 넥스지 토모야가 For You에 뜸 → 토모야 팬채널 "261023 NEON-A2O LITE" 커버가 A2O LITE 게스트 출연으로 태그돼 있었다.
-- 같은 유형 전수: 제목 "날짜 …-…" + with_groups 있음 + cover_of_groups 없음 59행 중, 사람이 제목을 하나씩 본 결과 커버 49(원곡자로 이동)·시각 '2pm'을 그룹 2PM으로 오인 3(떼기만)·자기 곡/자기 그룹 2(떼기). 리액션 캠 4·포토타임 1은 그대로.
-- 원곡자는 곡이 확실한 것만(넥스지 세이타 Keep on Moving·runway·Eye to Eye는 2PM만 떼고 원곡 비움). tags_manual 행은 없음(조건으로도 막음).
-- 되돌리기: sql/cover_with_fix_2026-11-05_undo.sql (백업 표 _bak_cover_with_fix_20261105)
create table if not exists _bak_cover_with_fix_20261105 as select id, with_groups, cover_of_groups from yt_channel_videos where id in ('0tQTVUNvjEs','p482QxJ4-cE','dLCaMO3K_s4','UO87QWzJA-Y','wmvRKNd8dyY','C0kpjVZbKrI','6fJuWHCXR-0','1yoAUc9Q-1w','zUhyfrvPTek','1fByt5KeyWE','W20v0CEHSOQ','8YVX2cgw1aw','KXj-PZgwUTE','2NL7EPp58lw','9L0JC9wf_2M','st8hLwvDNNI','zry9BoaIeXA','qUZYr1Hozlk','Tx0XdkBLz_Q','UOd_Y8duamc','Zg-YMDwxRS0','rNKwd_YE8Pc','JYF-vMWXYgc','ydmL_CGZXpQ','Eep2BK9ftkg','cNrGklyndxk','T1ZoW17AsDc','6Kjt1hz5L5o','WKKkxyaBDA0','0G14LYsPhuM','STfioicTEjQ','6nu0rF80Uhg','__pUKLJjMoA','TRqXwWrisTU','1oBXKoS_4eQ','wVaFVN__QYs','Mqb-92vPMq0','rpoWX52PXbQ','OUYCi2boIrI','AQPx9ZEcjD0','cwV7B0bjiI0','3FBcKAUJvbg','yvkAH2az2yc','br8GyJYuFN4','b4d-2_n_dEk','5AhI3dS1VtQ','Rwm5dif-BDs','xDjEIiFfdTE','Lie3G9mCNQw','y0mVGgk-V70','70SlTH7fy3I','QWP2ftofMTY','CAneYndvi1w','0lRiGNgqj2g');
alter table _bak_cover_with_fix_20261105 enable row level security;
update yt_channel_videos set cover_of_groups=array['A2O LITE']::text[], with_groups=array_remove(with_groups,'A2O LITE') where id='0tQTVUNvjEs' and not coalesce(tags_manual,false);
update yt_channel_videos set cover_of_groups=array['트와이스']::text[], with_groups=array_remove(with_groups,'트와이스') where id='p482QxJ4-cE' and not coalesce(tags_manual,false);
update yt_channel_videos set cover_of_groups=array['2PM']::text[], with_groups=array_remove(with_groups,'2PM') where id='dLCaMO3K_s4' and not coalesce(tags_manual,false);
update yt_channel_videos set cover_of_groups=array['A2O LITE']::text[], with_groups=array_remove(with_groups,'A2O LITE') where id='UO87QWzJA-Y' and not coalesce(tags_manual,false);
update yt_channel_videos set cover_of_groups=array['씨엔블루']::text[], with_groups=array_remove(with_groups,'씨엔블루') where id='wmvRKNd8dyY' and not coalesce(tags_manual,false);
update yt_channel_videos set cover_of_groups=array['씨엔블루']::text[], with_groups=array_remove(with_groups,'씨엔블루') where id='C0kpjVZbKrI' and not coalesce(tags_manual,false);
update yt_channel_videos set cover_of_groups=array['에스파']::text[], with_groups=array_remove(with_groups,'에스파') where id='6fJuWHCXR-0' and not coalesce(tags_manual,false);
update yt_channel_videos set cover_of_groups=array['에프엑스']::text[], with_groups=array_remove(with_groups,'에프엑스') where id='1yoAUc9Q-1w' and not coalesce(tags_manual,false);
update yt_channel_videos set cover_of_groups=array['갓세븐']::text[], with_groups=array_remove(with_groups,'갓세븐') where id='zUhyfrvPTek' and not coalesce(tags_manual,false);
update yt_channel_videos set cover_of_groups=array['데이식스']::text[], with_groups=array_remove(with_groups,'데이식스') where id='1fByt5KeyWE' and not coalesce(tags_manual,false);
update yt_channel_videos set cover_of_groups=array['엑소']::text[], with_groups=array_remove(with_groups,'엑소') where id='W20v0CEHSOQ' and not coalesce(tags_manual,false);
update yt_channel_videos set cover_of_groups=array['2PM']::text[], with_groups=array_remove(with_groups,'2PM') where id='8YVX2cgw1aw' and not coalesce(tags_manual,false);
update yt_channel_videos set cover_of_groups=array['2PM']::text[], with_groups=array_remove(with_groups,'2PM') where id='KXj-PZgwUTE' and not coalesce(tags_manual,false);
update yt_channel_videos set cover_of_groups=array['스트레이키즈']::text[], with_groups=array_remove(with_groups,'스트레이키즈') where id='2NL7EPp58lw' and not coalesce(tags_manual,false);
update yt_channel_videos set cover_of_groups=array['스트레이키즈']::text[], with_groups=array_remove(with_groups,'스트레이키즈') where id='9L0JC9wf_2M' and not coalesce(tags_manual,false);
update yt_channel_videos set cover_of_groups=array['에스파']::text[], with_groups=array_remove(with_groups,'에스파') where id='st8hLwvDNNI' and not coalesce(tags_manual,false);
update yt_channel_videos set cover_of_groups=array['에스파']::text[], with_groups=array_remove(with_groups,'에스파') where id='zry9BoaIeXA' and not coalesce(tags_manual,false);
update yt_channel_videos set cover_of_groups=array['에스파']::text[], with_groups=array_remove(with_groups,'에스파') where id='qUZYr1Hozlk' and not coalesce(tags_manual,false);
update yt_channel_videos set cover_of_groups=array['블랙핑크']::text[], with_groups=array_remove(with_groups,'블랙핑크') where id='Tx0XdkBLz_Q' and not coalesce(tags_manual,false);
update yt_channel_videos set cover_of_groups=array['애프터스쿨']::text[], with_groups=array_remove(with_groups,'애프터스쿨') where id='UOd_Y8duamc' and not coalesce(tags_manual,false);
update yt_channel_videos set cover_of_groups=array['에프엑스']::text[], with_groups=array_remove(with_groups,'에프엑스') where id='Zg-YMDwxRS0' and not coalesce(tags_manual,false);
update yt_channel_videos set cover_of_groups=array['카라']::text[], with_groups=array_remove(with_groups,'카라') where id='rNKwd_YE8Pc' and not coalesce(tags_manual,false);
update yt_channel_videos set cover_of_groups=array['카라']::text[], with_groups=array_remove(with_groups,'카라') where id='JYF-vMWXYgc' and not coalesce(tags_manual,false);
update yt_channel_videos set cover_of_groups=array['트와이스']::text[], with_groups=array_remove(with_groups,'트와이스') where id='ydmL_CGZXpQ' and not coalesce(tags_manual,false);
update yt_channel_videos set cover_of_groups=array['트와이스']::text[], with_groups=array_remove(with_groups,'트와이스') where id='Eep2BK9ftkg' and not coalesce(tags_manual,false);
update yt_channel_videos set cover_of_groups=array['트와이스']::text[], with_groups=array_remove(with_groups,'트와이스') where id='cNrGklyndxk' and not coalesce(tags_manual,false);
update yt_channel_videos set cover_of_groups=array['에이핑크']::text[], with_groups=array_remove(with_groups,'에이핑크') where id='T1ZoW17AsDc' and not coalesce(tags_manual,false);
update yt_channel_videos set cover_of_groups=array['애프터스쿨']::text[], with_groups=array_remove(with_groups,'애프터스쿨') where id='6Kjt1hz5L5o' and not coalesce(tags_manual,false);
update yt_channel_videos set cover_of_groups=array['투어스']::text[], with_groups=array_remove(with_groups,'투어스') where id='WKKkxyaBDA0' and not coalesce(tags_manual,false);
update yt_channel_videos set cover_of_groups=array['스트레이키즈']::text[], with_groups=array_remove(with_groups,'스트레이키즈') where id='0G14LYsPhuM' and not coalesce(tags_manual,false);
update yt_channel_videos set cover_of_groups=array['샤이니']::text[], with_groups=array_remove(with_groups,'샤이니') where id='STfioicTEjQ' and not coalesce(tags_manual,false);
update yt_channel_videos set cover_of_groups=array['원더걸스']::text[], with_groups=array_remove(with_groups,'원더걸스') where id='6nu0rF80Uhg' and not coalesce(tags_manual,false);
update yt_channel_videos set with_groups=array_remove(with_groups,'2PM') where id='__pUKLJjMoA' and not coalesce(tags_manual,false);
update yt_channel_videos set cover_of_groups=array['뉴진스']::text[], with_groups=array_remove(with_groups,'뉴진스') where id='TRqXwWrisTU' and not coalesce(tags_manual,false);
update yt_channel_videos set with_groups=array_remove(with_groups,'2PM') where id='1oBXKoS_4eQ' and not coalesce(tags_manual,false);
update yt_channel_videos set cover_of_groups=array['2PM']::text[], with_groups=array_remove(with_groups,'2PM') where id='wVaFVN__QYs' and not coalesce(tags_manual,false);
update yt_channel_videos set cover_of_groups=array['갓세븐']::text[], with_groups=array_remove(with_groups,'갓세븐') where id='Mqb-92vPMq0' and not coalesce(tags_manual,false);
update yt_channel_videos set with_groups=array_remove(with_groups,'2PM') where id='rpoWX52PXbQ' and not coalesce(tags_manual,false);
update yt_channel_videos set cover_of_groups=array['동방신기']::text[], with_groups=array_remove(with_groups,'동방신기') where id='OUYCi2boIrI' and not coalesce(tags_manual,false);
update yt_channel_videos set cover_of_groups=array['엑소']::text[], with_groups=array_remove(with_groups,'엑소') where id='AQPx9ZEcjD0' and not coalesce(tags_manual,false);
update yt_channel_videos set cover_of_groups=array['2PM']::text[], with_groups=array_remove(with_groups,'2PM') where id='cwV7B0bjiI0' and not coalesce(tags_manual,false);
update yt_channel_videos set cover_of_groups=array['블랙핑크']::text[], with_groups=array_remove(with_groups,'블랙핑크') where id='3FBcKAUJvbg' and not coalesce(tags_manual,false);
update yt_channel_videos set cover_of_groups=array['블랙핑크']::text[], with_groups=array_remove(with_groups,'블랙핑크') where id='yvkAH2az2yc' and not coalesce(tags_manual,false);
update yt_channel_videos set cover_of_groups=array['블랙핑크']::text[], with_groups=array_remove(with_groups,'블랙핑크') where id='br8GyJYuFN4' and not coalesce(tags_manual,false);
update yt_channel_videos set cover_of_groups=array['아일릿']::text[], with_groups=array_remove(with_groups,'아일릿') where id='b4d-2_n_dEk' and not coalesce(tags_manual,false);
update yt_channel_videos set cover_of_groups=array['슈퍼주니어']::text[], with_groups=array_remove(with_groups,'슈퍼주니어') where id='5AhI3dS1VtQ' and not coalesce(tags_manual,false);
update yt_channel_videos set with_groups=array_remove(with_groups,'세이마이네임') where id='Rwm5dif-BDs' and not coalesce(tags_manual,false);
update yt_channel_videos set cover_of_groups=array['동방신기']::text[], with_groups=array_remove(with_groups,'동방신기') where id='xDjEIiFfdTE' and not coalesce(tags_manual,false);
update yt_channel_videos set with_groups=array_remove(with_groups,'세븐틴') where id='Lie3G9mCNQw' and not coalesce(tags_manual,false);
update yt_channel_videos set cover_of_groups=array['아이들']::text[], with_groups=array_remove(with_groups,'아이들') where id='y0mVGgk-V70' and not coalesce(tags_manual,false);
update yt_channel_videos set cover_of_groups=array['씨스타']::text[], with_groups=array_remove(with_groups,'씨스타') where id='70SlTH7fy3I' and not coalesce(tags_manual,false);
update yt_channel_videos set cover_of_groups=array['블랙핑크']::text[], with_groups=array_remove(with_groups,'블랙핑크') where id='QWP2ftofMTY' and not coalesce(tags_manual,false);
update yt_channel_videos set cover_of_groups=array['씨스타']::text[], with_groups=array_remove(with_groups,'씨스타') where id='CAneYndvi1w' and not coalesce(tags_manual,false);
update yt_channel_videos set cover_of_groups=array['블랙핑크']::text[], with_groups=array_remove(with_groups,'블랙핑크') where id='0lRiGNgqj2g' and not coalesce(tags_manual,false);
select count(*) filter (where cardinality(cover_of_groups)>0) covered, count(*) n from yt_channel_videos where id in ('0tQTVUNvjEs','p482QxJ4-cE','dLCaMO3K_s4','UO87QWzJA-Y','wmvRKNd8dyY','C0kpjVZbKrI','6fJuWHCXR-0','1yoAUc9Q-1w','zUhyfrvPTek','1fByt5KeyWE','W20v0CEHSOQ','8YVX2cgw1aw','KXj-PZgwUTE','2NL7EPp58lw','9L0JC9wf_2M','st8hLwvDNNI','zry9BoaIeXA','qUZYr1Hozlk','Tx0XdkBLz_Q','UOd_Y8duamc','Zg-YMDwxRS0','rNKwd_YE8Pc','JYF-vMWXYgc','ydmL_CGZXpQ','Eep2BK9ftkg','cNrGklyndxk','T1ZoW17AsDc','6Kjt1hz5L5o','WKKkxyaBDA0','0G14LYsPhuM','STfioicTEjQ','6nu0rF80Uhg','__pUKLJjMoA','TRqXwWrisTU','1oBXKoS_4eQ','wVaFVN__QYs','Mqb-92vPMq0','rpoWX52PXbQ','OUYCi2boIrI','AQPx9ZEcjD0','cwV7B0bjiI0','3FBcKAUJvbg','yvkAH2az2yc','br8GyJYuFN4','b4d-2_n_dEk','5AhI3dS1VtQ','Rwm5dif-BDs','xDjEIiFfdTE','Lie3G9mCNQw','y0mVGgk-V70','70SlTH7fy3I','QWP2ftofMTY','CAneYndvi1w','0lRiGNgqj2g');
-- 추가 2행(같은 팬채널, 제목 끝 "곡 - Stray Kids" 형식): 토모야 Walkin On Water 커버
insert into _bak_cover_with_fix_20261105 select id, with_groups, cover_of_groups from yt_channel_videos where id in ('4u6nhl2yycQ','RgZ2wsHDfDU') and id not in (select id from _bak_cover_with_fix_20261105);
update yt_channel_videos set cover_of_groups=array['스트레이키즈']::text[], with_groups=array_remove(with_groups,'스트레이키즈') where id in ('4u6nhl2yycQ','RgZ2wsHDfDU') and not coalesce(tags_manual,false);
