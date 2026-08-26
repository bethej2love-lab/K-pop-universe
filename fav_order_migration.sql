-- 즐겨찾기 표시 순서(favOrder) 계정 간 동기화용 컬럼 (2026-08-26)
-- 각 즐겨찾기 행 케밥(⋮) 메뉴의 ↑위로/↓아래로/⤒맨위로로 정한 순서를 dk 배열('g:..'/'m:..'/'c:..')로 저장.
-- 실행 전엔 순서가 기기 로컬(localStorage)로만 유지되고, _saveFavOrder의 서버 push가 콘솔 에러를 낸다(무해).
-- 실행 후 다른 기기에서도 같은 계정이면 순서가 동기화됨.

alter table public.user_data
  add column if not exists fav_order jsonb not null default '[]'::jsonb;
