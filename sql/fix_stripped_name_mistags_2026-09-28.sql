-- 성 뗀 이름 조각 오태깅 정리 (2026-09-28)
-- 원인: 매처가 활동명·일본 이름까지 성을 떼서(제이미→"이미", 유아이→"아이", 조한국→"한국", 이정신→"정신" …)
-- 그 조각이 평문으로 나온 외부 채널 영상에 엉뚱한 멤버·그룹을 붙였다. 코드는 admin.js _atmStripSurname에서 수정.
-- 대상은 "제목에 조각만 있고 정식 이름은 제목·설명 어디에도 없으며, 고친 매처로 다시 돌리면 그 멤버가 안 나오는" 행.
-- ⚠️ 전부 tags_manual = false 조건 — 수동 편집한 행은 건드리지 않는다.
-- 제외: 마카야 8건("카야(KAYA)"가 다른 사람인지 확인 필요), 주학년 "아돌라/학년·재중" 2건(정당).
BEGIN;

-- ① 새 매처로는 아이돌이 아예 안 잡힘(409건) → 그 멤버 태그 제거 + 무관(숨김). 이미 다른 플래그가 있으면 유지.
UPDATE yt_channel_videos SET members = array_remove(members, '마유카'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('fyzLmZW2P6U','zbsDQdDAFxo');
UPDATE yt_channel_videos SET members = array_remove(members, '마사토'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('FsttU34erfM','81o-ulAcJ3c','yAyd5ZvzgvY','niEIfxaD_5o','RAsWcEOi_ss','h0WYEnXIBCQ','yF-SAt56kP0','Rai2eBDboRk','5Q00he7evjM','DmG21NaKjKo','CsFQJoDH3uw');
UPDATE yt_channel_videos SET members = array_remove(members, '유우시'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('beSFLbg6Sp0');
UPDATE yt_channel_videos SET members = array_remove(members, '주학년'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('Zsg9fHXJrfA','UkuAWJXgeFc');
UPDATE yt_channel_videos SET members = array_remove(members, '조한국'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('OkoY_bjmhRw','HRNjHe9Zwtg','aJgwP5dvMKw','CVZxpe0I9Oo','4J5u-OLhthg','ntHGU9fXMro','hVhMpjJUGx0','ayEs5JpK5e8','1hEQBnM8V7k','_KGwNxHiWkc','-AgTHqZrsI4','fncsYs469Qo','OD0N5AEjZSQ','GrWxxxkur7M','DPR8DGypcxM','eDv0_JcDiN0','zvT1bZkS6zo','jL0GwvVyMdc','JYmPYsY0kAc','1KUD8n-NpGg','KpITgi3gx60','r4ggaGvjXdI','6BjBLYOl2-E','ypj5qBRfsV8','M4oh3qn8m9Y','-O5B8sOUcpQ','NfyKq6hhZcs','OAtWzG1X1LU','O_GYrGuzxW8','srQUaCncTmA','LFmbZnlg-_s','160rd7XMJgk','nKHRxkqRt3Y','2BE18P09A74','BfnJTQXRxco','t4uf61-vUYE','01cLw6S0hdU','-2RQmhnurSQ','LYJrQVsi4GQ','x6fOpMfN0pI','jaVlHPHAukg','fEz9gfBZ8cA','ShP-oxQh3NU','DKdy3l4AxLM','TXmlJFi2ntE','N9WO26-ay9c','mbgtJXCtiVA','50GbIzTI8c0','Le0fweUNql0','Lp2eJP4BNPs','ptp89Ux8BSk','qNSMMm_ldxI','CjLo6GB9e0Y','DHaIKmru-gM','rC2OTzp3kPI','RR0Xx9_VBNY','saMl2fPsM6k','K6hK_5uUz5s','-G2vYY5Qaps','bU1mAXSNp-A','xcFPMQtUsr4','s4JQtBTspNk','4Wt5S3ld1Qg','5Q0ePW-3cVw','cRdNOx4sJUQ','eYqwx4lJhVA','g8aeJ_Oah0Q','jrW8sVZFxww','cwv7fummhWg','wrTi3iNBwSk','Y9HUIG7HAB8','49DssNpMMeY','Gf_PzejHleQ','vhU_rZKjKj0','FXCMyiJxCCI','1-qkAUUBerI','o2K9-NdN2A4','OXyXEP5OYOA','NliSrLizPTM','NG9_cXv6sk0','h_WXYrIYhWE','tRpLxLe4Ynw','y0kMDEztVMY','f5RAFwRB578','MDvFJkUDuuE','buTJx6kj-gE','Cp29joMPidU','IbyENLyuYGE','2mXFAgacsVs','Ni3QQmic5pU','aSKEn6ujcFg','pmPfEVkjDjQ','dt-sC8cQewo','e8d6Ny3KAJY','0J8aEsRjNnA','CMJ5ybXLEHY','EAuIfxJAHb8','SONfQM_7nl4','XSA1tLTSkzI','02wbIuBZgvA','6rclMCN7OGs','-QAIaTJoVdg','byos81V-sAA','gLFyqVQo3Tg','hCyYgAJxBe4','i8iyQhld_xs','Rj6RVOrO8hU','tW94OlWqNT8','YVzUP0K4_hY');
UPDATE yt_channel_videos SET members = array_remove(members, '이정신'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('xKaXHHGQGcE','BxGtccaLVlI','ABY6GhoFu18','PaeAE39lKa8','VnwMUOA47UY','RdQ1fkNVyvQ','O_1RXJiNXZY','Ooh9izliQI4','AvUaLtvb7lc','lrDelD7FeFc','5c_70URgr9s','SEoh8GArKcI','fehzVzoPhME','MBS9uiNv_rY','cFgWxOQ-SEs','TTBJ_UAkqSg','qKA1hiX4hrU','YBTvJRLbQEI','lX4PH9f0TIg','zSLMK_Ne4dE','V1Jszatvi8Y','xrSBYlDdPHA','exmSO-VFewg','MAy0147Rgj4','XNHchcQ89Ks','t5n_yr751mE','DIZ8B2ofzaU','mi3iVnFcr2E','68LpbjopLwA','f_0S--IHKNQ','oQO626n3Dog','u0Re0gKhris','YPnlMiv-nFA','Q2Bn7uJelrI','AqzD1-Jv4_k','4Fm9JujhHiw','EkJ-0L2FQZw','qhqgNrGZHLg','tEJqUQPFW6w','0kDuMLHGPsE','tHi8jRFfmpY','e2zVqL99bO4','qSubemxjP9Q','o1lalV2LkVc','JMFVvjoaZFI','u7SG4BAQyag','6ghlT-43kkE','IDsZXOKgDN4','O6EeXkWpS-w','R5qRqDEHBx4','u6jJYt2dxoA','4-8E8zRZZ3Q','U_hd_W0hYvk','Zp25AQj_hdQ','f4IU2ATClMI','pdnBaAri3XE','NQKVzJHqelM','EO3cfdsDJKQ','lU--UdvCMaU','JTUINCUUeak','1EekXdBfMlU','dwYkeWRc3Ug','qaXQYlvcCe0','JgPvIzgR8HY','L6t4Ct0VsWo','xWCVoRp-ezw','gPIDxpQC6tQ','ZKr4FU--_14','3l7vv24fPK0','F3WCSD0gSLU','0ypnGdo_VTg','KAU1Emypm1c','pkXWENn5PpM','eUpNa7xp9Zg','M-6NXRYFW8w','n33i0QomDqw','_uS7yRvfgu4','uxMJqraDSAA','kDT1LBRXdjA','kZb6Iw51Tl8','5U-FLfyQS_U','_uBMi-sjvwQ','5BO1Mo0zGBo','A0T62KVoL1s','NvKLG1XRFRQ','JFb2KPGA45g','UfoJs-xM7Ow','VhRuyzOYy3o','X_JoDqUwECU','rVr8eWkkk1s','7JH5SLozmCU','-RwUTByNiKQ','sKGyTfs_dmk','QIWHe9RdguI','Cmzm2_1DfOY','OrtHJriIJ6k','yyVkx4r00R8','A_quDIH7wqA','MQolrGHJ8dA','xN2U2lap1Uw','_J-Xi9uXPrY','A1IEIu4mZwM','iZug1i77yMg','mxLnh_88HbI','32rBFBUpnoU','L6ECMWQCDhM','NglFtgH6G6s','nJtJt36opx0','TZ0n1ks2EWQ','YD_jMOWCVdQ','Aui7qbgTrns','g9XW2pISf2s','uCKTFLluyVA','Orjfd1bVk30','WKF7zrtT95k','8cyl3PKxNgY','I3OXgMtmwcg','Dlk_4M7-tH4','-cIr0vQJ3l8','-gQV5hXwL7Q','4OMfBc7RPos','7nvKAhTGBLc','9uXtOqxv-_Y','BfyazV8O-_g','HkVtuczfF4I','Rd5EAeNF3DQ','3VrjWCnVwik','NvK6NPWy1Lo','O8jc52Hw_to','V7ew6FaPGAE','rbNhTTA359g','W9zPNAn0UZQ','yf9RPSGzQ5Y');
UPDATE yt_channel_videos SET members = array_remove(members, '소피아'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('C9Um0WmAI9w','qViy5l0cxgE','NtzxrPKpl_E','V27lJw3H4HU','OKQFnQh7-aY');
UPDATE yt_channel_videos SET members = array_remove(members, '제이엘'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('D9Bby9YxU84','WmovXxfgwOI','Kj3yPfGh3nM','6fDLmSXyGjo','FZhvIUqXRoA','EcuAx6XLs1U','EZiaOsMiBzY','GFFrEW1KXLk','zEjrOlb3QQE','E13dlbLn20M','imhS0wxEds4','46mLOellJK0','jv87J2D1X2Y');
UPDATE yt_channel_videos SET members = array_remove(members, '제이미'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('2MevxaeHv20','atTQqjBwa3E','oESdeT2tyeA','JM6FPzGhA4A','mBunNTNF4So','lSnuazcx9TU','R6kEzUlHnxg','BBeNA6v0uK0','sKBQu3SZYCQ','cTDNR1Cw5oI','KA7VjebMZCY','HHYmTs4lGr8','S20m04K5CUk','o1wnqWFvpzk','yaa59fODI7c','_A3pH0QhafI','XD_qNRribWo','qGNl-2sDDkI','OSz3g8enp0U','gexmJq0bmSA','feK6EhrzxvE','bW6u24LPQQ0','1_MUPI2Z4d0','6H-bFI2MR74','NzlHGazB1vQ');
UPDATE yt_channel_videos SET members = array_remove(members, '류수정'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('i0bfhy2UkDk','vj33SnW66OA','XwylqhF1R5Q','bPh35wSfLvk','dMdFWPhMf-Y','xqUnZ8Y2SMc','nVhi7SL00cs','qxFErVAcqMo','GFAEn6crV84','_XgCePt8Lm4','n3HgxveaIrw','Isuyixi_Ll8','zWbpcoF7XkY','WmMLHY80a5A','0VSCiRm6zsg','8d1RFKRR1Ks','FCk7Yl-_mdg');
UPDATE yt_channel_videos SET members = array_remove(members, '이나은'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('oa_54uyqbsc','sU97GRbdVOs','DGF0TvLlUvM','WcXJWnWl_kA','T9iRElo5TKg','-RJuBnrcDQk','GyLktadM7Fk','fYPtHVyYPiQ','8BkJ2QclL7M','eFvOlq8rhy4');
UPDATE yt_channel_videos SET members = array_remove(members, '장수원'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('ceu1Nr33-N8','1vJ1Pu3Iz74','QayJvljiIGg','DioSGKFxowU','LRQnxKM1JZg','KAPVTECmLGM');
UPDATE yt_channel_videos SET members = array_remove(members, '유아이'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('iZNeFbUX2fw','GGr5ZzBanGU','iuuVfORcXxA','WLSVMvtGn10','4TPoYsOfiPw','ir0bmGQYLME','R1R8UBZZZpk','J8VKe5wI0-g','h_mRl7ndKXI','5k1sTk0OVFI','WG4-oQ5O0ts','saSN8b4VMco','_LPT00o2uAo','jod3NGTxT28','Dd_pLAEIbzQ','zK1vIWNFtLE','WdRUJWQvuaw','oGGCTSOvhbk','unVV9UfvEr8','js4vYwaL80c','PYfaKkP4vbE','6jZRmmeenOk','TTJDsEzL89w','C3qVS-b9LEk','UkgLxCy9dN0','h2xUw6ds1XU','Q-bLfxw8xyI','jBMhi9Z8WtI','giW7o-13R8U','SSu3OLfgvEE','qjpO8uoH9E8','igi00kdMLoM','msDJxb2_sJk','5XnQM9scaMI','db13XBRrtBE','TiNCgkXQUYw','YF8uWPQmVVU','TsygpL6vX64','UaorrgDvfT4','5f2KBgmGUY0','vszy5oV8-2c','wmeN2fdcr-w','PHeJvXuHXpo','AOkDccArHlI','S6RCbT_djB8','ZoXGn28uLKo','OQkDCbWuGZo','PUOwHWAQl44','rRFfSSiPg8M','hzlSj0tYV-w','ONSZoJZZEDg','hpZccflJgVI','yY3MMJF_Kcg','pPCmNgz4tvw','zgqF3vsb1Ik','-rWk92JiwtI','u-aaeLsfl-A','xIDWSW2zhlE','do5FWw0kPKA','QY9okVkYgYA','TvObnDAKNDk','WjmwQtgk3vg','jXU0AAvz3Jg','9IDVDUuTDrM','lY6xGfywMXg','CdgT6xMAijo','F7csGk_oC9E','pfmMv5BEAZ4','__uJReYaueA','a7VbXD2-Bbo');
UPDATE yt_channel_videos SET members = array_remove(members, '선샤인'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('xWF9HuT_1q0','C1ng_JtfqgU','dUu9orKEp4s','ir9NuazYtHQ');
UPDATE yt_channel_videos SET members = array_remove(members, '사바나'),
  content_flag = COALESCE(content_flag, '무관'), flag_source = CASE WHEN content_flag IS NULL THEN 'auto' ELSE flag_source END,
  flagged_at = CASE WHEN content_flag IS NULL THEN now() ELSE flagged_at END
WHERE tags_manual = false AND id IN ('DsaL6W3eeYk');

-- ② 그룹은 맞고 그 멤버만 틀림(7건) → 멤버 태그만 제거
UPDATE yt_channel_videos SET members = array_remove(members, '마시로') WHERE tags_manual = false AND id IN ('ZPL5uwzo-yI');
UPDATE yt_channel_videos SET members = array_remove(members, '이정신') WHERE tags_manual = false AND id IN ('WmDgb3go13U','Uw6C_9BgCXk');
UPDATE yt_channel_videos SET members = array_remove(members, '최태인') WHERE tags_manual = false AND id IN ('6RHjhimQhao','GoSWemH_FvM','nCsd2w9pfPE','STCUmfyL3AI');

-- ③ 다른 그룹으로 바뀜(11건) → 멤버 태그 제거 + 검수 큐(그룹 재배정은 사람이 — 새로 잡힌 쪽도 "알고 보니"→보니처럼 틀린 게 섞임)
UPDATE yt_channel_videos SET members = array_remove(members, '마유카'), needs_review = true WHERE tags_manual = false AND id IN ('ic0opApBMRY');
UPDATE yt_channel_videos SET members = array_remove(members, '류수정'), needs_review = true WHERE tags_manual = false AND id IN ('4srdoYuqK0U','YMfX7jV-cIA','TNzE8h54EqA');
UPDATE yt_channel_videos SET members = array_remove(members, '제이엘'), needs_review = true WHERE tags_manual = false AND id IN ('QomboNyZUug');
UPDATE yt_channel_videos SET members = array_remove(members, '이정신'), needs_review = true WHERE tags_manual = false AND id IN ('HfTdPEZKoWM','OzhOZax3Gkk','9S0o0r3y5HA','hCg_L_QszGk');
UPDATE yt_channel_videos SET members = array_remove(members, '조한국'), needs_review = true WHERE tags_manual = false AND id IN ('MFKUbR_F41A','Q-oG5-FKO6s');

-- ④ 게스트 태그(with_members) 조각 오태깅(74건) → 게스트 태그만 제거
UPDATE yt_channel_videos SET with_members = array_remove(with_members, '제이미(피프틴앤드)') WHERE tags_manual = false AND id IN ('2TwAzjfOaes','K14CJxGQhtQ','eyYCBLp56tY','48Re5C4PeC4','q7PHLymOCjQ','T9kKL195QyY','OuEuFgLPgmo','MzMpz5d8Ero','5AHi2r3UTDA','91UbWXPT13w','130KCza6bQI','NfnHihuBs6I');
UPDATE yt_channel_videos SET with_members = array_remove(with_members, '조한국(트렌드지)') WHERE tags_manual = false AND id IN ('9elCC6vfdkI','Haaeo0UpznQ','CAL8PlM1FUw','jG5_md_sA-0','Flm3gmV1Nmo','fQqFPPXtyRY','j3Q17gqv09o','V3ONBXR9kAA','Fhu-HCHTe6U','i3gZF9pUEmw','a7TgDtmH4fY','Je_V6ef2n8w','f02rNoDmDYA','M8nNFd91xn8','PHSokPOVZjM','zQSLu3GGaNc','BDjn5nc8bmM','pn6y5FsItPY','FyZap1yGUYA','Fbqh2lfwsxk','7v1fNEDtKBY','mPQTOfZDepc','-9rRS1pKR6U','TlkIG4ep0gc','-QTp-n1HWwM','Dhjld74OXUc','h-0rtdRTRFc','p8yW2ya9VP8','S4rSLGW3RYw','5MTUOrkste8','XPvRaeOF5pg','B4tSAGEeIB0','iMTAuYyvn8M','rlU8_vjSecs','v2hYqk8wIuU','fYmnNxjah3E','zzUhDpK4QK0','FpOtjO5z0m4','03qgycKScD4','9X1dRWKYfHw','OZCSfBnWkLo','UgZTJe_-LHo');
UPDATE yt_channel_videos SET with_members = array_remove(with_members, '이정신(씨엔블루)') WHERE tags_manual = false AND id IN ('dPYSbwIJw5w','dbekBb7-whw','5snDB4jDqqo','IeI9998A0z4');
UPDATE yt_channel_videos SET with_members = array_remove(with_members, '유아이(드림노트)') WHERE tags_manual = false AND id IN ('J5IM4rLyKzE','35-GhOxbaI8','jzz-xQq-1M4','6wUhBc1BwrM','6wojC5xmq4o','23WjSh-BXpI','WTobHpPj_-Y','bocV9jG3J5U','dFB_O1ifhc8','KACVgLDrxHI','uDw0YcEVSEA','52k3_haryBw','myUyY3bT2Ec','tksLvl9wsZU');
UPDATE yt_channel_videos SET with_members = array_remove(with_members, '장수원(젝스키스)') WHERE tags_manual = false AND id IN ('NHSUz-DGHx4');
UPDATE yt_channel_videos SET with_members = array_remove(with_members, '마시로(메이딘)') WHERE tags_manual = false AND id IN ('7CR7A9if_us');

COMMIT;
