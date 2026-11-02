-- 제보·제안 창구(2026-11-02) — 영상·그룹·멤버 카드 ⋮에서 열면 "무엇에 대한 제보인지"를 같이 저장. Claude Code가 실행함.
-- category 값: video(영상이 잘못됐어요) · info(정보가 틀렸어요) · add(추가해 주세요) · idea(아이디어·의견) · rights(권리 침해 신고). 옛 값 bug/suggest/etc는 그대로 둠.
alter table public.feedback add column if not exists target_type text;   -- 'video' | 'group' | 'member'
alter table public.feedback add column if not exists target_id text;     -- 영상 id / 그룹 키 / "그룹:멤버"
alter table public.feedback add column if not exists target_label text;  -- 사람이 읽는 이름(영상 제목·그룹명·멤버명)
alter table public.feedback add column if not exists handled_at timestamptz;
create index if not exists feedback_status_time on public.feedback(status, created_at desc);

-- ⚠️ 이 표는 RLS가 켜진 채 insert 정책만 있었다 → 관리자 화면(admin.js _loadFeedback)이 select를 못 해 늘 0건으로 보였다.
--   관리자만 읽기·처리(상태 바꾸기)·삭제.
drop policy if exists feedback_admin_select on public.feedback;
create policy feedback_admin_select on public.feedback for select to authenticated using (coalesce(auth.jwt()->>'email','') = 'bethej2love@gmail.com');
drop policy if exists feedback_admin_update on public.feedback;
create policy feedback_admin_update on public.feedback for update to authenticated using (coalesce(auth.jwt()->>'email','') = 'bethej2love@gmail.com');
drop policy if exists feedback_admin_delete on public.feedback;
create policy feedback_admin_delete on public.feedback for delete to authenticated using (coalesce(auth.jwt()->>'email','') = 'bethej2love@gmail.com');
