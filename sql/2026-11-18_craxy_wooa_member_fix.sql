-- 2026-11-18 Opus: hold_restore_batch1의 크랙시 우아 8건 후속 정정 — 초안이 members=array['우아']로 넣었는데 등록 키는 김채원(별칭 우아·Woo-Ah).
-- 같은 사람이 콜라보 태그(with_members '김채원(크랙시)')로도 붙어 있던 것을 본인 멤버로 옮기고 콜라보에서 뺀다.
update yt_channel_videos set members=array['김채원'], with_members=array_remove(with_members,'김채원(크랙시)')
 where id in ('57gCvxNFH34','B8tlAjehh4Q','k2IzwO3yqe8','o1nInWeHzaQ','TmkYpXWq8xo','UI68X2yLMag','ws3rbuQZdvw','zy5Xv7x1e0w')
   and group_ko='크랙시' and members=array['우아'] and tags_manual=false;
select id, group_ko, members, with_members, content_flag from yt_channel_videos where id in ('57gCvxNFH34','B8tlAjehh4Q','k2IzwO3yqe8','o1nInWeHzaQ','TmkYpXWq8xo','UI68X2yLMag','ws3rbuQZdvw','zy5Xv7x1e0w');
