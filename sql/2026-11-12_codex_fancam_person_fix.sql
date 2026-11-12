-- 2026-11-12 Codex 검수 — 직캠 순위·멤버 직캠 모음·멤버×곡 페이지에 남의/단체 영상이 개인 직캠으로
-- 원본 제목에 촬영 대상이 명시된 것만. 모두 tags_manual=false. 백업 후 수정.
create table if not exists _bak_codex_fancam_person_20261112 as
  select id, members from yt_channel_videos
   where id in ('gQrM7MiidfU','-QIVArbnexY','fHIwsnMV_dU','MrOXMFHWcQY','FFVH_J1AIQw','xcP5RsiZirY','4UjbLdrFshs','Wbarf6hxOqE','oQAeA1xEhxc');
-- 단체 영상(하츠투하츠 STUDIO CHOOM Full Focused 3개, ITZY 공식 단체 안무 Close-up CAM) → 그룹 전체
update yt_channel_videos set members='{}' where id in ('gQrM7MiidfU','-QIVArbnexY','fHIwsnMV_dU','MrOXMFHWcQY') and tags_manual is not true;
-- 한국예지동아리 채널의 다른 멤버 직캠(제목에 대상 명시)
update yt_channel_videos set members='{채령}' where id in ('FFVH_J1AIQw','Wbarf6hxOqE') and tags_manual is not true;
update yt_channel_videos set members='{류진}' where id='xcP5RsiZirY' and tags_manual is not true;
update yt_channel_videos set members='{유나}' where id='4UjbLdrFshs' and tags_manual is not true;
-- 싸이커스 'Kick It' MINJAE FANCAM
update yt_channel_videos set members='{민재}' where id='oQAeA1xEhxc' and tags_manual is not true;
-- 되돌리기: update yt_channel_videos t set members=b.members from _bak_codex_fancam_person_20261112 b where t.id=b.id;
select id, members from yt_channel_videos where id in ('gQrM7MiidfU','-QIVArbnexY','fHIwsnMV_dU','MrOXMFHWcQY','FFVH_J1AIQw','xcP5RsiZirY','4UjbLdrFshs','Wbarf6hxOqE','oQAeA1xEhxc');
