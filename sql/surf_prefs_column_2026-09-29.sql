-- Surf 학습 기록(v2) 계정 동기화 컬럼 (2026-09-29)
-- 어떤 관계 행(함께한 멤버·쓴 곡·같은 곡·같은 무대 …)을 자주 펼치고 넘어가는지 {행키: 점수}로 저장 → 그 사람의 Surf 행 순서만 개인화.
-- 앱은 이 컬럼이 **있을 때만** 동기화한다(_pullServerToLocal에서 존재 확인) — 없으면 기기(localStorage)에만 쌓인다.
-- 기존 user_data RLS(본인 행만 읽기/쓰기)가 새 컬럼에도 그대로 적용된다.
alter table public.user_data add column if not exists surf_prefs jsonb default '{}'::jsonb;
