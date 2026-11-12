-- 2026-11-12 Codex 11-12 검수의 개별 오귀속(영상 ID·원본 근거는 Codex 메모 — CHANGELOG 같은 날 '검수 처리 ④'). 전부 tags_manual=false(조건으로 다시 확인).
-- 각 줄은 현재 값이 메모 때와 같을 때만 바뀐다(조건 불일치면 0행). 되돌리기: sql/2026-11-12_codex_mistag_batch_undo.sql(백업 표 _bak_codex_mistag_20261112).
create table if not exists public._bak_codex_mistag_20261112 as
  select id, group_ko, members, with_members, with_groups, cover_of_groups, content_flag from yt_channel_videos where id in
  ('L9p-4UaEf2I','4PmHyx3s-pk','IRZzeqwXfkI','oAwzFFEYm38','gYU3wXLOVWI','smVMa0yjA0o','l0IzwuYQ4VI','-9AlUSygAaM','qfVuRQX0ydQ','kxLL0xY4pzw','frFjjDFZe_Q','McEcxRDCffU',
   'pKOH7o0gxrE','4j2iJE6Z9Tw','yqYEtrrbIdU','Fvl5wvd9HDI','0M7JgODlSx4','BL0O0twDoCY');
alter table public._bak_codex_mistag_20261112 enable row level security;
-- god 카드: SBS 퇴근길 LIVE는 (여자)아이들(원본 설명 명시)
update yt_channel_videos set group_ko='아이들' where id='L9p-4UaEf2I' and group_ko='god' and tags_manual is not true;
-- 드림캐쳐 수아 ← 첫사랑(CSR) 수아 직캠(첫사랑 미등록 → 드림캐쳐와 무관)
update yt_channel_videos set content_flag='무관' where id='4PmHyx3s-pk' and group_ko='드림캐쳐' and tags_manual is not true;
-- 미래소년 이준혁 ← 배우 이준혁(덱스의 냉터뷰, 원본 설명 '비질란테')
update yt_channel_videos set content_flag='무관' where id='IRZzeqwXfkI' and group_ko='미래소년' and tags_manual is not true;
-- 소녀시대 효리수(효연·유리·수영, SM 공식) — 멤버 없이 그룹 전체로 저장돼 태연 등 다른 멤버 카드에 붙었다
update yt_channel_videos set members=array['효연','유리','수영'] where id in ('oAwzFFEYm38','gYU3wXLOVWI','smVMa0yjA0o') and group_ko='소녀시대' and members='{}' and tags_manual is not true;
-- 이승철 '소녀시대'(KBS 한가위 대기획) — 소녀시대와 무관
update yt_channel_videos set content_flag='무관' where id='l0IzwuYQ4VI' and group_ko='소녀시대' and tags_manual is not true;
-- 애프터스쿨 ← 곡/코너 이름 'After School': 위클리 곡 2, 소디엑 현식 곡 1, After School Club 누에라·이펙스 편
update yt_channel_videos set group_ko='위클리', with_groups='{}' where id in ('-9AlUSygAaM','qfVuRQX0ydQ') and group_ko='애프터스쿨' and tags_manual is not true;
update yt_channel_videos set group_ko='소디엑', members=array['현식'], with_members='{}' where id='kxLL0xY4pzw' and group_ko='애프터스쿨' and tags_manual is not true;
update yt_channel_videos set group_ko='누에라', with_groups='{}' where id='frFjjDFZe_Q' and group_ko='애프터스쿨' and tags_manual is not true;
update yt_channel_videos set group_ko='이펙스', with_groups='{}' where id='McEcxRDCffU' and group_ko='애프터스쿨' and tags_manual is not true;
-- 앤더블 장하오 ← 보이넥스트도어 이한 'White(핑클)' 직캠(원본 설명 2023 가요대전 이한)
update yt_channel_videos set group_ko='보이넥스트도어', members=array['이한'], with_groups='{}', cover_of_groups=array['핑클'] where id='pKOH7o0gxrE' and group_ko='앤더블' and tags_manual is not true;
-- 이즈나 정세비 'FIESTA' — 피에스타와 함께가 아니라 아이즈원 곡 커버
update yt_channel_videos set with_groups='{}', cover_of_groups=array['아이즈원'] where id='4j2iJE6Z9Tw' and group_ko='이즈나' and tags_manual is not true;
-- 크레용팝 ← 퀸덤2 효린 'Waka Boom'(씨스타 효린, feat. 이영지)
update yt_channel_videos set group_ko='씨스타', members=array['효린'] where id='yqYEtrrbIdU' and group_ko='크레용팝' and tags_manual is not true;
-- TXT 'The Biggest Winner' — 위너 출연 아님
update yt_channel_videos set with_groups='{}' where id='Fvl5wvd9HDI' and with_groups=array['위너'] and tags_manual is not true;
-- 피에스타 ← 아이즈원 'FIESTA' 무대·발매 인사
update yt_channel_videos set group_ko='아이즈원', with_groups='{}' where id in ('0M7JgODlSx4','BL0O0twDoCY') and group_ko='피에스타' and tags_manual is not true;
select t.id, t.group_ko, t.members, t.with_groups, t.cover_of_groups, t.content_flag from yt_channel_videos t join _bak_codex_mistag_20261112 b using(id)
 where row(t.group_ko,t.members,t.with_groups,t.cover_of_groups,t.content_flag) is distinct from row(b.group_ko,b.members,b.with_groups,b.cover_of_groups,b.content_flag);
