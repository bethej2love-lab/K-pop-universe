-- 되돌리기: 2026-11-11 음방 1위 곡 제목 정정
update music_show_wins w set song_title=b.song_title from _bak_win_titles_20261111 b where w.id=b.id;
