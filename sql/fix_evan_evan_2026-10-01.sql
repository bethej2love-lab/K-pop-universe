-- 솔로 에반(전 엔하이픈 희승) 영상이 데일리디렉션 E-VAN(이반)으로 태깅된 것 정리 (2026-10-01)
-- 원인: E-VAN의 하이픈을 떼면 'EVAN'이 되고, 에반(a0132)은 active:false라 매처 후보에서 빠져 있었다 → "에반 (EVAN)" 제목이 전부 E-VAN으로.
-- 코드: 에반 active:true, E-VAN은 이름만으로 역추론 금지(데일리디렉션 문맥 있을 때만)·별칭 이반. 탐험 차트 태깅 줄 표시로 발견.
-- 대상: 고친 매처가 "에반"으로 판정한 행만 id로 지정(데일리디렉션 자체 무대 2건은 제외). tags_manual=false만.
BEGIN;

-- ① 영상 주인 교정 45건 — 데일리디렉션 E-VAN → 에반(솔로 키)
UPDATE yt_channel_videos SET group_ko = '에반', members = ARRAY['에반']
WHERE tags_manual = false AND group_ko = '데일리디렉션' AND members = ARRAY['E-VAN'] AND id IN ('uecqs4w9KP8','wfxdHsy4sHk','w57XUw3zgJc','BmItOgbEK_c','gQ9axTeJBQc','0HlepX0gu7U','_HI1PThzkeQ','LEVMiy1w2FQ','mHbMmT947nQ','uXkfxb5_ZIM','yn3MW2IrUFU','bTqDFI3LO9A','S1rsJmTx_MU','MsxiNAAQWaE','z2KEYfT2PVI','JVKYQHlsAh0','Tu2683JFi-Y','5PgsHn7QqxM','bFeLgQnuH7Y','Jmvu3OsrHrA','c1eKIPpUGpk','ve_YZtx2seQ','GZYi4yZ9lRE','-hYIhmBY64s','-7qYnwgnI2U','a44NoIBASns','F_Kt2yx68xA','y2bSScf-K-g','jM9MAmr7ug4','L88jONzUv20','cB1TVFlFEtc','2xumHpsxEDg','MT7aTqsDR_g','nAQj963YK9Q','PVkxR42rr7A','QMjYhW-QF5o','tdFHDK_Nk6Y','uzZwfo9h4bQ','EWB5VSegWgY','_XVaGt8V0yc','eSycpx48uts','LMeR9bd-JiY','IoovISVA1L0','lvzsJM5rvCY','RQ7rZa7n3t4');

-- ② 콜라보 교정 4건 — 에반(에반)을 with_members에 넣는다
--    10-02 실측: E-VAN(데일리디렉션)은 그새 빠져 with_members가 빈 배열이 됐다(array_replace는 헛돌게 됨).
--    그래서 "E-VAN은 빼고, 에반이 없으면 추가"로 바꿨다. 두 상태 어느 쪽이든 같은 결과.
UPDATE yt_channel_videos
SET with_members = array_append(array_remove(with_members, 'E-VAN(데일리디렉션)'), '에반(에반)')
WHERE tags_manual = false AND NOT ('에반(에반)' = ANY(with_members))
  AND id IN ('Ks7jBJVqk6Y','LlsgSILVH_8','fJbwhXmwfs8','qHv8fiNYF54');

COMMIT;
