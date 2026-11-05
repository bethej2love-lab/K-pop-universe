-- 음방 1위 곡명에 남은 위키 각주·탭 정리 (2026-11-05): 'Good Goodbye [ a ]', 'Call Me Baby<TAB> <TAB>†' 등 13행
-- 되돌리기는 의미 없음(표기 찌꺼기 제거만)
update music_show_wins set song_title = btrim(regexp_replace(regexp_replace(song_title, '\s*\[\s*[a-z]\s*\]', '', 'g'), '[\s†‡]+$', '', 'g'))
where song_title ~ '\[\s*[a-z]\s*\]' or song_title ~ '[\t†‡]';
select show, win_date, song_title from music_show_wins where song_title ~ '\[\s*[a-z]\s*\]' or song_title ~ '[\t†‡]' or (win_date in ('2025-01-05','2025-12-07','2026-01-11','2015-04-05','2019-12-22') and show in ('인기가요','쇼음악중심')) order by win_date;
update music_show_wins set song_title = regexp_replace(song_title, '\s*	\s*', ' ', 'g') where song_title like '%'||chr(9)||'%';
select count(*) from music_show_wins where song_title like '%'||chr(9)||'%';
