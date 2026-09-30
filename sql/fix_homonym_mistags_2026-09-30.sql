-- 유니버스 밖 동명 아티스트 오태깅 정리 (2026-09-30)
-- 발견 경위: 스포티파이 앨범 신원 대조(영상 제목에 그 사람 곡이 있나)를 만들다가, 증거로 쓰려던 영상 자체가
--   다른 사람 것인 경우가 나왔다.
-- ① 밴드 LUCY(신예찬·최상엽·조원상·신광일) 무대·예능 102건이 위키미키 루시로 태깅돼 있었다.
--    현 매처는 이미 안 붙인다(옛 로직 잔재). 위키미키 자체 채널(KiKi-LOG·88s)·여러 멤버 태그·애매한 3건은 제외.
-- ② 싱어송라이터 민수(Minsu — "민수는 혼란스럽다", 쿨룩 LIVE, 아리랑 K-Pop Live Session)·최민수 18건이 티오원 민수로.
--    admin.js _ATM_COMMON_KO_WORDS에 민수·루시 추가(이름만으로 역추론 금지 — 그룹 문맥·해시태그는 인정).
-- 처리: 그 멤버 태그 제거 + 무관(숨김) — 우주 밖 사람이라 보류가 아니라 무관(2026-09-28 선례와 같음).
-- ⚠️ 전부 tags_manual = false 조건 — 수동 편집 행은 안 건드린다. id를 직접 지정해 범위가 늘지 않는다.
BEGIN;

-- ① 밴드 LUCY → 위키미키 루시 오태깅 102건
UPDATE yt_channel_videos SET members = array_remove(members, '루시'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('ywdCiPK-LRc','fPwYZGCsUTI','Yl99pAW4MCU','JxXacQj7RQk','BxAjrxIQr7c','w6kCIqwkCt4','_ce1qPoqDkc','fXf8vdvXunE','4iI641p0B-c','2Lg9IuBQz8w','n8NWtNCmp1Q','espRg39fT1A','Quhf0Ssq9_M','_KfZgO9Wa-w','FfB89nFsG9Y','tDumragu1Mw','igSmOhNRsbM','RX08png2BBs','wWc_ltaT3I0','QEvFsVP6f6o','xH1Nwvn1C9o','tFTl-wee9s8','ETtKTh1DIEk','S4PL6aMcwrQ','ANMcoqifCrY','bvKctowGvE4','OycDzXU-9M8','yEAk4QzZ4Vo','Sc_tFpYirH8','pn38w28GBaE','bJuNY9TKS3Q','GdPa_EHfqpQ','GETxpmQ00qw','sBDkkMRpOBk','udp90ZXr2VE','EzURIZBsGpI','nnXQpFskV8I','1lAvfK81BF4','lc2MatsK6h4','Vlowsod9_Tc','NmK-qQ1TG8M','9vPGDATI-As','B9pZ5YZ4CoM','hSpEuqrxLXI','iDrEQSTUFuA','CxSRN4rsETE','BPOxklqZOMY','Lglz_8k6wz8','qSY1XRMSHaw','bRXK9O3b_WE','nzHPditXWNA','HxmoQCMM3Dg','7Sp_Ps1O89M','n_gfJboofMo','OoTZy2koo8M','SbPZk-OpQMo','dNPI3Kd4Fjs','Fxs9IKnveME','9s-RVoQDCB8','VCcM0ODSNic','TVaiWY-FlEE','A7naHIIAxUA','6ZLJo6VIVx4','79h07q722sM','RZ6Se18nJ3E','QQHaz5HzQbU','san8TyNMBCs','SEoHHFU0-EI','5comre719Dw','ThTbFJP4oic','O_6rtRfoAZM','xEWtPgcaOe8','hhf6vVpWzX4','zG-4iam7Okc','cCfmEBnE-EE','C6wnkMJunVg','ztvlaZw3U6o','_2p7uSrrw0E','kt1ZiFlq9X0','KxNVDZHLx1k','lM3HNDZ8oj4','MOKg_sdBr2A','yzjucArrPIs','OSeLdhhNkb4','SUKsXjvT5pM','U2D1M6iLbe4','V5g_QnCMo4g','wswZE4gD13I','ARABVelx82c','YP-fo0P-rr0','7-udyfc3ZcA','HcuVpZVslzg','XOfI4NdzR20','b6FvN7UC02Q','kgzupObpgqc','X930rmVYpD8','LHBkGYOsILo','05D_-esbKO4','bad5Usuf91A','hfl9tpg2jeQ','Tz0s1JAgqU4','zPz_ST7uq0M');

-- ② 싱어송라이터 민수 → 티오원 민수 오태깅 18건
UPDATE yt_channel_videos SET members = array_remove(members, '민수'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('fIUsc5ayQHM','Qq-jRJ8e3jI','uaPaxvvw_rI','tnIcu3ITFTk','b6PEUibx7AM','abNwz2quJj4','FVFQEJQESzQ','tgRkKJKPjJA','l6TIJJHvDk0','0rbKa7UKxYw','1LI_M6Ei2D4','x5kMvhGSx5U','mqXNEvzGnN8','ou3DJ2Z-E5g','OX9apbPKQRM','ZxZRGEtKtg0','5Tz0ko43xCc','NpDqBoQmC6A');

COMMIT;
