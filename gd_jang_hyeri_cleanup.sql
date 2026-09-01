-- 걸스데이 혜리 ↔ 장혜리(지인) 동명이인 오태깅 정리 (2026-09-01)
-- 지인(장혜리)은 데뷔 초기 4개월만 활동, 혜리는 그 뒤 합류 → 둘은 걸스데이에 같이 있던 적이 없다.
-- 매처가 '장혜리'의 성 뗀 변형 "혜리"를 현 멤버 혜리(name.ko='혜리')와 겹쳐 매칭해, 혜리 영상마다
-- 장혜리가 딸려붙었다(실측 388건, 전부 혜리와 공존·수동편집 아님 = 100% 충돌). 로직은 _atmMatchesMember에
-- 충돌 가드를 추가해 재발 차단했고, 이 SQL은 이미 쌓인 오태깅을 청소한다.
UPDATE yt_channel_videos
SET members = array_remove(members, '장혜리')
WHERE members @> ARRAY['장혜리']::text[]
  AND tags_manual = false;
