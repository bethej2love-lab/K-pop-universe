-- 2026-11-04 Codex 검수116차(68차 DK·주호 후속) 확정분 8행. 근거: Codex audit68 worktree CHANGELOG 68차(공식 원본 제목·설명·자막).
-- 원칙(10-26 감사345·10-27 audit10_11과 같음): 출연자가 유니버스에 없으면 무관(manual).
-- ① 무관 7행: 드라마 '유미의세포들3' 주호 역 장면(SF9 주호 아님) · 디셈버 DK 공연/방송 4(it's Live·복면가왕·인기가요 2) · 복싱 'DK Yoo(유대경)' 패션필름 · 라디오에서 DK를 이야기로만 언급(도겸 출연 아님)
-- ② 엔플라잉 '잔불' 쇼츠(#디셈버 #DK 선배님): 엔플라잉 연결은 두고 잘못 붙은 DK 두 게스트 도겸(세븐틴)·도균(블랭키)만 뺌, 수동 잠금.
-- 보류(그대로): 더리슨 7yth6JPTpBk·Qoyj4jWumWI·ztN8NlF_HMM, Blue by DK IJ6c4oOj11s, Forever 챌린지 E2vMjLqKljM, Moonlight paradise glyGUvEB5-Q — 원본 출연 범위 확인 전.
-- 값이 그대로일 때만. 되돌리기: codex_audit116_fix_2026-11-04_undo.sql
create table if not exists public.bak_codex_audit116_20261104 as
  select id,group_ko,members,with_members,with_groups,content_flag,flag_source,flagged_at,needs_review,tags_manual,now() backed_at
  from public.yt_channel_videos where id in ('Djaawgoru2A','BBGHql5kmIU','IgXOhhJb1Yo','2vnpxHFZnIs','rvXqx8AOAd8','CoN2gB5PGWo','uFvQhy8UKI0','spP_i3Cx6-w');
alter table public.bak_codex_audit116_20261104 enable row level security;

update public.yt_channel_videos set content_flag='무관', flag_source='manual', flagged_at=now(), needs_review=false
where id in ('Djaawgoru2A','BBGHql5kmIU','IgXOhhJb1Yo','2vnpxHFZnIs','rvXqx8AOAd8','CoN2gB5PGWo','uFvQhy8UKI0')
  and content_flag is null and tags_manual=false;

update public.yt_channel_videos set with_members='{}', tags_manual=true
where id='spP_i3Cx6-w' and group_ko='엔플라잉' and with_members=array['도겸(세븐틴)','도균(블랭키)']::text[] and tags_manual=false;

select id,group_ko,members,with_members,content_flag,flag_source,tags_manual from public.yt_channel_videos
where id in (select id from public.bak_codex_audit116_20261104) order by id;
