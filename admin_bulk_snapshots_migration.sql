-- 일괄 작업 실행 취소(undo) 스냅샷 테이블 (2026-08-22)
--
-- 어드민 패널의 대량 스윕/재검증/재스캔 버튼이 수백~수만 행을 자동으로 바꾸기 "직전"에, 바뀔 행들의
-- 상태를 batch(1회분) 단위로 여기에 떠둔다. 오조작 시 어드민의 "↩︎ 마지막 일괄 작업 되돌리기" 버튼이
-- 가장 최근 batch를 통째로 이전 상태로 복원 — undo가 곧 백업이 되는 구조(자문 백업전략 #1).
--
-- 이 SQL을 Supabase SQL 에디터에서 1회 실행하면 되돌리기 기능이 켜진다. 실행 전까지는 스윕 버튼을
-- 눌러도 작업 자체는 정상 진행되고, 스냅샷만 조용히 건너뛴다(되돌리기는 그만큼 불가).

create table if not exists admin_bulk_snapshots (
  snap_id     bigint generated always as identity primary key,
  batch_id    text        not null,           -- 한 번의 일괄 작업 = 하나의 batch_id
  op_label    text        not null,           -- 어떤 버튼이었는지(예: "그룹배정 신뢰도 재스캔")
  row_id      text        not null,           -- 바뀐 yt_channel_videos 행의 id
  before_data jsonb       not null,           -- 그 행의 "바꾸기 전" 값(복원용 컬럼들)
  created_at  timestamptz not null default now()
);

create index if not exists idx_abs_batch   on admin_bulk_snapshots (batch_id);
create index if not exists idx_abs_created on admin_bulk_snapshots (created_at desc);

-- ⚠️ RLS(행 수준 보안): 이 테이블은 관리자 패널 전용 내부 데이터라, yt_channel_videos에 읽기/쓰기가
-- 되는 것과 "동일한 접근 경로"로 읽기·쓰기·삭제가 돼야 한다.
--   • yt_channel_videos가 RLS 미적용이라면 → 이 테이블도 그대로(아래 두 줄 실행하지 말 것). 기본값.
--   • yt_channel_videos가 RLS + 정책을 쓰고 있다면 → 아래 두 줄의 주석을 풀고, using/with check 조건을
--     그 테이블의 관리자 정책과 동일하게 맞춰서 실행할 것.
-- alter table admin_bulk_snapshots enable row level security;
-- create policy "admin_bulk_snapshots all" on admin_bulk_snapshots for all using (true) with check (true);
