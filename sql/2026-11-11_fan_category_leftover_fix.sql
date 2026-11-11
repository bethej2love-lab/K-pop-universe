-- 2026-11-11: 옛 category='fan'이 남은 수동 잠금 15행 → 내용 기준 분류(출처는 이미 source_tier='fans')
-- 사용자 제보: 투어스 영재 '너의 모든 가능성이 되어줄게' 팬미팅 직캠(U5QNHCyKvXI)이 영재 카드 퍼포먼스 탭에 안 뜸.
-- 11-10 팬 출처 층위 전환 때 tags_manual 행은 건드리지 않아 'fan'으로 남았고, 퍼포먼스 탭은 category='live'만 보여준다.
create table if not exists _bak_fan_leftover_20261111 as select * from yt_channel_videos where category='fan';
alter table _bak_fan_leftover_20261111 enable row level security;
update yt_channel_videos set tags_manual=false where category='fan' and tags_manual=true;
-- 무대·직캠 → live
update yt_channel_videos set category='live' where category='fan' and id in (
 'Xfb27p-Rvzs','ZUH2qEkI_zQ','ye_LlXwsdbE','YhV4vz64KOs',  -- 갓세븐 진영 시상식 무대 직캠
 'UO87QWzJA-Y','0tQTVUNvjEs',                              -- 넥스지 토모야 NEON 무대 직캠(쇼츠)
 'EYL9BXBb9eo','ADN86AMoMTw',                              -- 세븐틴 CxM 팬파티 Fiesta 무대(쇼츠)
 'aEQo2RODaQc','66GEuXlvKnw','bjY9Fl0DC8w',                -- 코르티스 연말 무대 커버 직캠
 'U5QNHCyKvXI','66XW9Mxrels');                             -- 투어스 영재 팬미팅 무대 직캠
-- 무대가 아닌 것 → other (원빈 데뷔 축하 영상, 리센느 미니팬미팅 풀캠)
update yt_channel_videos set category='other' where category='fan' and id in ('SRR0DTHCj3I','ojLcfRv4dNw');
update yt_channel_videos set tags_manual=true where id in (select id from _bak_fan_leftover_20261111 where tags_manual=true);
select category, count(*) from yt_channel_videos where id in (select id from _bak_fan_leftover_20261111) group by category;
