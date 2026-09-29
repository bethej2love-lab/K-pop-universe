-- 다른 사람 풀네임·협찬 크레딧 오태깅 정리 (2026-09-29)
-- 원인: ① "제임스 안 (James An)"·"Eric Nam"·"Bobby Kim"·"Stella Jang"처럼 **서양식 활동명 + 한국 성** = 동명의 다른 사람인데
--         이름만 보고 코르티스 제임스·더보이즈 에릭·아이콘 BOBBY·하츠투하츠 스텔라 등으로 태깅됐다.
--       ② "THE FIRST TAKE powered by ASAHI SUPER DRY"(맥주 협찬)가 트레저 아사히로 잡혔다.
-- 코드는 admin.js _atmStripOtherPersonFullNames / _ATM_BRAND_PHRASES(전 매처 공용 전처리)에서 수정 — 새 영상은 더 안 들어온다.
-- 대상: 태그가 있는 전체 258,752행을 고친 매처로 다시 돌려(설명란 포함) **그 멤버가 더 이상 안 잡히는 행**만. 행별 검토 완료.
--   · 남는 근거가 없으면 멤버 태그 제거 + 무관(81건) — 유니버스 밖 인물(제임스 안·에릭남·바비킴·스텔라장·유승준…)의 영상
--   · 다른 근거가 남으면 그 태그만 제거(1건)
-- ⚠️ 전부 tags_manual = false 조건 — 수동 편집한 행은 건드리지 않는다. 이미 다른 플래그가 있으면 유지.
-- 제외: Jackson Wang 2건(갓세븐 잭슨 본인 — 코드에서도 wang을 성 목록에서 뺐다).
BEGIN;

-- 스텔라 → 태그 제거 + 무관 (18건) 예: 존박X스텔라장 (Stella Jang) -  What Are You Doing New Year’s Eve? 
UPDATE yt_channel_videos SET members = array_remove(members, '스텔라'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('_90kO__ZVRE','2O76-HkT13w','4SOWX7udfyQ','8mUVAatiOcs','8XsPPhP-IVI','CfcUuqkeT_s','cNY_BDEDSnc','g6UyjDaUaAY','hN3FC6VQMmQ','I0KRoJv42aI','O-D5ZQJ608U','ql7u_-2V5-A','usrYr7EHuhw','vU7m6JWzc6I','xwIGFRVz3ZQ','Y25zPuNO0XU','YMZG_jJoqKo','zhSnLXkbEgQ');

-- 제이 → 태그 제거 + 무관 (1건) 예: Jay Lee Award Recipient - Mason Howell Interview! #THECJCUP 
UPDATE yt_channel_videos SET members = array_remove(members, '제이'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('_iP1LjXCh30');

-- 에릭 → 태그 제거 + 무관 (31건) 예: Eric Nam, Paradise (에릭남, 파라다이스) [THE SHOW 200811] UHD
UPDATE yt_channel_videos SET members = array_remove(members, '에릭'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('_VfXwKrhZgE','-4pG6gKLNao','-vp1z1BrXEg','0Wtaoag1w7E','6pbOXr8iw9g','7lq9OJ_bG8o','ao2MGFehbFk','BdNiEBl981M','bOgSd7b1VuA','BSm90k_USZY','dxyADoS4OP8','e0_qaUB66x8','E0DPfVqBHdI','EFkXKzzTzNc','F4DeQQtObZQ','fCeAM_BYa9M','FICusNO6_0I','FTDYB310WhE','HcDDO1W5Ge8','HFKg2wShVu8','i-0Iji_L7co','LfPCgNOfIk8','LYFi2xWlkmk','lZ1_ykAiKw8','qchz6SBgdO0','qxDMGOtIqhc','S3nBaGKg8t4','SauwWrNNOOQ','TrqMmVQX2yg','vy8Jdh1kuVw','XVJE5YSFDbw');

-- 루시 → 태그 제거 + 무관 (3건) 예: [MPD직캠] 루시 신예찬 직캠 4K '벚꽃 엔딩' (LUCY SHIN YE CHAN FanCam) | @M
UPDATE yt_channel_videos SET members = array_remove(members, '루시'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('1vJWt9seaGw','CGmvBh8Kt5Q','OEaslM9iIQk');

-- 제임스 → 태그 제거 + 무관 (9건) 예: 제임스 안 (James An) - Mia Wallace | K-Pop Live Session | The Ar
UPDATE yt_channel_videos SET members = array_remove(members, '제임스'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('1WCQF7Fv9TE','1zZHd6EZfaA','7sLg2EH8yPI','cJgC--LZcpY','o391R1o3tIs','p3rkYlmNlVg','qId-qkTZu0U','RJEYAqemeTM','TaAgmnQWXxc');

-- 스티브 → 태그 제거 + 무관 (5건) 예: 음악캠프 - Steve Yoo - Passion, 유승준 - 열정, Music Camp 19990515
UPDATE yt_channel_videos SET members = array_remove(members, '스티브'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('3gHQAbVGWNM','GJ27H0uWM24','hJmsoIJNGtM','RVm9mH1xLis','x-t3OQsdNHs');

-- BOBBY → 태그 제거 + 무관 (6건) 예: 바비킴(Bobby Kim) - 골목길(An alley) & 고래의 꿈(Falling in Love Again
UPDATE yt_channel_videos SET members = array_remove(members, 'BOBBY'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('7gVEEpkNdTU','bzbRRUv0ZEY','CD5YNPJpDAs','jjQtUQQrfEM','xOTN6IFUiX8','zq8OA1UNKX4');

-- 케빈 → 태그 제거 + 무관 (1건) 예: [MPD직캠] 보이드 케빈박 직캠 4K 'Tug of War' (V01D KEVIN PARK FanCam) 
UPDATE yt_channel_videos SET members = array_remove(members, '케빈'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('EjAkhJsoP5I');

-- 크리스(크리스) → 태그만 제거 (1건) 예: [Radio’ Clock] Tea Time Monday with Chris Koo (크리스쿠)
UPDATE yt_channel_videos SET with_members = array_remove(with_members, '크리스(크리스)')
WHERE tags_manual = false AND id IN ('H-36SJc4OfM');

-- 헌터 → 태그 제거 + 무관 (1건) 예: [Culture Crunch] Kreme de la Kreme with Creator Hunter Lee 헌
UPDATE yt_channel_videos SET members = array_remove(members, '헌터'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('HVRe-Q5m1wY');

-- 아사히 → 태그 제거 + 무관 (4건) 예: 斉藤和義 - 明日大好きなロックンロールバンドがこの街にやってくるんだ / THE FIRST TAKE powered
UPDATE yt_channel_videos SET members = array_remove(members, '아사히'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('If4e3rpAgj0','IsePSioTVic','OS2Ak15iIi0','XGmYvJB8mlc');

-- 류셰닝 → 태그 제거 + 무관 (1건) 예: Sally Kim – Reason Why | [TEXTED] 샐리 | 가사 (Lyrics) | 딩고뮤직 | 
UPDATE yt_channel_videos SET members = array_remove(members, '류셰닝'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('IpQ5L_qlnes');

-- 류셰닝(류셰닝) → 태그 제거 + 무관 (1건) 예: 미드에서 이런 노래 들어본 것 같은데…☁️ | Sally Kim –Reason Why
UPDATE yt_channel_videos SET with_members = array_remove(with_members, '류셰닝(류셰닝)'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('oT3r5sZKrt0');

COMMIT;
