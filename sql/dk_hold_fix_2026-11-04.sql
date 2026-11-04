-- 2026-11-04 Codex 68·116차 DK 보류분 정리(근거: 저장된 공식 제목·설명).
-- 7yth6JPTpBk·Qoyj4jWumWI: SBS '더 리슨: 우리 함께 다시'의 DK = 디셈버 DK(미등록). 제목에 #유회승 명시 → 세븐틴 도겸이 아니라 엔플라잉 유회승.
-- ztN8NlF_HMM: 같은 프로그램, 제목은 #DK만 — 출연자를 특정할 근거가 DK(디셈버)뿐 → 무관.
-- E2vMjLqKljM: 설명 "DK(디셈버) 'Forever' … 배낭메고 버스킹3 … #주호" — 발라드 가수 주호(미등록), SF9 주호 아님 → 무관.
-- 그대로: IJ6c4oOj11s(세븐틴 공식 #도겸X승관 #DxS가 디셈버 DK 'Blue'를 부름 — 출연 태그 맞음), glyGUvEB5-Q(2016 라디오 'DK - 무조건' 근거 부족, 보류).
create table if not exists public.bak_dk_hold_20261104 as
  select id,group_ko,members,with_members,content_flag,flag_source,flagged_at,needs_review,tags_manual,now() backed_at
  from public.yt_channel_videos where id in ('7yth6JPTpBk','Qoyj4jWumWI','ztN8NlF_HMM','E2vMjLqKljM');
alter table public.bak_dk_hold_20261104 enable row level security;
update public.yt_channel_videos set group_ko='엔플라잉', members=array['유회승']::text[], with_members='{}', tags_manual=true
where id in ('7yth6JPTpBk','Qoyj4jWumWI') and group_ko='세븐틴' and members=array['도겸']::text[] and tags_manual=false;
update public.yt_channel_videos set content_flag='무관', flag_source='manual', flagged_at=now(), needs_review=false
where id in ('ztN8NlF_HMM','E2vMjLqKljM') and content_flag is null and tags_manual=false;
select id,group_ko,members,with_members,content_flag,tags_manual from public.yt_channel_videos where id in (select id from public.bak_dk_hold_20261104) order by id;
