-- 2026-11-11 사용자: "투어스 plot twist라고 하면 아무도 모름 — 첫 만남은 계획대로 되지 않아". 음방 1위 기록(위키 영문 제목)을 디스코 공식 제목으로.
-- 수집기는 ignore-duplicates라 고친 행을 다시 덮어쓰지 않는다.
create table if not exists _bak_tws_win_titles_20261111 as select * from music_show_wins where group_ko='투어스';
alter table _bak_tws_win_titles_20261111 enable row level security;
update music_show_wins set song_title='첫 만남은 계획대로 되지 않아' where group_ko='투어스' and song_title='Plot Twist';
update music_show_wins set song_title='마음 따라 뛰는 건 멋지지 않아?' where group_ko='투어스' and song_title='Countdown';
update music_show_wins set song_title='내가 S면 넌 나의 N이 되어줘' where group_ko='투어스' and song_title='If I''m S, Can You Be My N?';
update music_show_wins set song_title='널 따라가 (You, You)' where group_ko='투어스' and song_title='You, You';
select song_title, count(*) from music_show_wins where group_ko='투어스' group by 1 order by 2 desc;
