-- 음방 1위 동명 영문 이름 오배정 정정 (2026-11-05)
-- 위키 수집기가 영문 이름이 같은 사람 중 아무나 골랐다: JIN(러블리즈) ← 방탄 진, 서지수(러블리즈) ← 블랙핑크 지수
-- 되돌리기: sql/music_wins_namesake_fix_2026-11-05_undo.sql
update music_show_wins set member_ko='진' where group_ko='솔로' and member_ko='JIN' and song_title='Don''t Say You Love Me';
update music_show_wins set member_ko='지수' where group_ko='솔로' and member_ko='서지수' and song_title in ('Click','Earthquake');
select member_ko, win_date, show, song_title from music_show_wins where group_ko='솔로' and member_ko in ('진','지수','JIN','서지수') order by win_date;
