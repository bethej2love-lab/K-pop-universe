-- 2026-11-11 KBS 예능 '체험! 직캠의 현장' 8건이 직캠 낱말 때문에 live(퍼포먼스)로 들어가 있던 것 → variety(예능).
-- 샤오쥔 공유 썸네일이 이 예능이었다는 제보로 발견. 분류 규칙도 admin.js _ytClassify에 예외 추가.
-- 함께: ioeh9JCZn3c "WayV 텐x샤오쥔" — 텐 누락 보충. 전부 tags_manual=false 확인.
-- 되돌리기: update yt_channel_videos set category='live' where id in (아래 8개); 텐 제거는 array_remove(members,'텐').
update yt_channel_videos set category='variety'
where id in ('IgoqmD-Qvlo','8lWSmMv2fw4','ioeh9JCZn3c','2PKQr0gG5Jk','ZLJc0M-IzqA','f6xI4JzgXSc','rSnephN7KTU','6WUv6DZJ69g')
  and category='live' and coalesce(tags_manual,false)=false;
update yt_channel_videos set members=array_append(members,'텐')
where id='ioeh9JCZn3c' and not ('텐'=any(members)) and coalesce(tags_manual,false)=false;
select id,category,members from yt_channel_videos where title ~* '체험! 직캠의 현장';
