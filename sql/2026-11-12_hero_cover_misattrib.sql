-- 2026-11-12 Codex 검수(그룹 대표 영상): 남의 곡 커버·솔로곡이 그룹 영상으로 저장돼 그룹 카드 맨 위 대표가 되던 3건. 전부 tags_manual=false(실행 전 확인).
-- 3v028rIpFyQ  [PLANET K] 경력직 '베리베리' ♬사랑하게 될 거야 - 온앤오프  → 부른 팀 베리베리, 원곡 온앤오프
-- 6itY9tdrrMI  [유니버스 티켓] #김수민 ♬White - 핑클 → 참가자 김수민(2005년생, 트리플에스 김수민 2007년생과 다른 사람 — SBS 참가자 프로필) 오태그 제거, 원곡 핑클
-- lTGaCt415CI  [MPD직캠] 김우석 1위 앵콜 'Sugar'(2021 솔로곡) → 엑스원 단체 영상이 아니라 김우석 본인(a0610) 태그
-- 되돌리기: sql/2026-11-12_hero_cover_misattrib_undo.sql
update yt_channel_videos set group_ko='베리베리', cover_of_groups=array['온앤오프'] where id='3v028rIpFyQ' and tags_manual is not true and group_ko='온앤오프';
update yt_channel_videos set with_members='{}', cover_of_groups=array['핑클'] where id='6itY9tdrrMI' and tags_manual is not true and with_members=array['김수민(트리플에스)'];
update yt_channel_videos set members=array['김우석'] where id='lTGaCt415CI' and tags_manual is not true and members='{}';
select id,group_ko,members,with_members,cover_of_groups from yt_channel_videos where id in ('3v028rIpFyQ','6itY9tdrrMI','lTGaCt415CI');
