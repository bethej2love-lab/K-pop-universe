-- 한 글자 영문 이름(K·V·Q·N·L·Y)·I.N 오태깅 + 그 여파로 그룹까지 잘못 들어간 영상 정리 — 2026-10-20 Claude Code
-- 원인: 멤버 영문명이 한 글자면 "K-POP"·"KCON 'K' Festival"·"#k_link"·"M/V"·제목 구분자 " l "에서도 그 멤버로 잡혔다(앤팀 케이 182건 등).
-- 코드는 admin.js에서 수정. 아래는 이미 저장된 데이터 정리. 수동 확정(tags_manual)·주인 채널(idol/fans/grpsub) 행은 제외했다.
-- 판정: 수정된 매처로 해당 멤버가 태그된 영상을 전부 다시 돌려서 "지금 로직은 안 붙이는" 것만.

-- ① 멤버 태그에서 그 사람만 빼기(다른 멤버 태그는 그대로)
UPDATE yt_channel_videos SET members=array_remove(members,'케이')
WHERE group_ko='앤팀' AND coalesce(tags_manual,false)=false AND id IN ('_CZ12TCfv1s','_gGvm0rbkZY','_kXFjDK0gJA','_ObqB6W4_qo','_P9WzjKJh2o','-7knB3g-KTs','0IPsZPYEec4','0J1IUUUnO4s','15uuM8nfbA4','2e7s8OnPvP4','2ee-YbDSnag','3FilUUeJ4HM','3hVBxqgVHAM','3oRu1kHwx5c','4cm4sLRhoeY','4F-gC-MAor8','4rtKR3JMmFE','4UYwrVJ0eT8','4wMJcNMyV6I','5AYRPEcw80k','5gWhJZjPazo','5LsZIyJ8oqU','5rSWjiR3_y8','5ZnCgy06U1I','6rEl5U5JqHs','6T06VuV7IZE','6umPnX5Pzeo','6WFtkaYWDs0','72MuxcOBqds','73doY-73YvA','7UZdg-8L21U','86PndC_Kg1Y','8Atvp3USZko','9N5wdArLDrk','9NfeboJr-2Y','A2oYKwuYcXY','aaVoo4XqgKQ','aD831iUlAuA','aKZ_dHruS-U','aNskz32aEFc','aTI81vfuqMk','b6PnbG_RJs4','B9ZUf-Wiiu4','bilseyGtOcE','BLxpiksZ37I','Bn2zDywVE58','BOm3_TWXf2k','C6ItJrSQl8I','c6OL4mSRbRs','c9aroBLDD30','CaUucuDiAzs','CDpMuPXqebo','cmUgb6Zer74','cqAcEICSfUo','CuX4XUZgBZE','CVk294tnqXg','d4jijda4PN4','d8zSD-P6pDU','DlbsOYcnmj0','dlY99v5nBZI','ean9qb2Xtpc','edtuzRbdlRo','eSHQ84O2tHE','ESZ9RWQB5uw','Fl5bP_dm6OM','Fp4WQSGdGJs','FQ3rbj9ooUA','Fs7w2RorHM0','FVBFTIxuBrw','GLqpjXxvWLY','h-OMxqR4jKE','HeyNJjzXZfw','HOqUqIkWz4Q','iuZ1iFu_oqQ','j0PsjK0t-sU','j27otWqUrDo','jEBKgfEJeNc','JfJY4GXsoDQ','jkK0myfvzik','jlhim4-9Ytk','jobACoI6cFA','jVvOI38unKw','jZNaTQnSSqk','k8_ylJXjtYQ','kAux_S35Idg','kEK77dbMxkg','KEXyYdn8QWs','KkW1kiCQbRQ','kmg8pg9XNzg','KQ9VW6I1heY','KY_Npf1ATR0','kZxxWOiWTFU','L_-gGvyXUnU','L_SuPOYDOhw','l_xlDEXhQrg','l0AJGMeAiUY','l1DXoCdMelM','L3ijT3JHZSk','LaHqCAJsslw','LfELh0br03Y','LIvzRzP5N0o','ls_WcTlosOY','lVQY4GCHmE4','LYblQhENP0I','m_SeKePaWgE','MeFmMhwxq4s','mHT0sv6Lc4o','mQ27axseZ4w','nAE4-_DB7sw','NlJXvrX1tq0','nPV7fu9v2pk','O3p-M4Rv2x4','o8T-OfTi9Yk','O9Fx5yTctSQ','obKgmRrzdWI','oKe3tuGi9FA','OKWBYO6xWdc','OMi5Rul0daM','OmMje8KSnUE','Or8SKB4daOI','P_89qu-3rnQ','PcF2p6I5odg','pF4Yd2J4Hvs','PkCOMcIf1LE','PtrxP_PNey4','pvFebW8JFdI','pY-CYCHDvYo','PZI4HxHcD0g','q_Rcw0NyHrk','qtqe_KkUAis','qtQn-mvHLQI','QU0DzP-3b30','r_ck_kqUHsQ','R5F3av-MI8g','r95M_tT5Mqo','rBtRT52qS6I','RgSURPXnEMo','RyI880srjUU','s4IkTnKd_fo','sgkF2GipOsM','SJwz9TCeyEo','sNbt9ljCWp4','sR9_UYW_h30','SROBEXTFkqs','SSklxxMRMHk','T_FlgcuDcw8','t1Iu9ayDBn8','TaYyq5qquK0','tGZmjuR6L_Y','ThTRCkwttHw','TuN-77wRAdQ','u_aw7TyL50k','u8ELWjfnOMg','UbBEnJ0b3dU','ucwNjimiyXU','UtlFWAqCHUg','V7rWHlVIQYs','vBA74Pcrylg','VLh3soclqyQ','VrgRUTq70ns','w3_ICsFrM7c','w7YZ4zH_TLs','wHF16YAuoRw','wjdHCa3gb5I','wJijySQ8jmQ','wXHzeEAh7_Y','x2wVFSRldAs','x9BkVovVIQA','xA2VZzEjhvs','Xd7udIFWUd4','XHNHTTTCIzg','YB5JECBe4S8','YG5JERSP9g8','YJJqd06VcVE','yUVh4wptfnU','yW_-NyPcaCE','z_9v-fbJ53s','ZAPNpOd40mM','ZGIIVImmQPI','ZlmM7OCHQsQ','zSJB7uJ_Vts','zSWquyeXGJg'); -- 앤팀 케이 182건

UPDATE yt_channel_videos SET members=array_remove(members,'아이엔')
WHERE group_ko='스트레이키즈' AND coalesce(tags_manual,false)=false AND id IN ('_UBaL2w57vg','-NTjD_Z6zkw','0im5OGhn5_c','0jX-1dNmJYE','0ONxtrsybIM','0QKhAdN-keY','0UOiW50CE6g','1inY1P4Xn6Y','1Vy82Zj4KIw','2MoUqq3bDao','30OpgokL5iY','3FAHOyL0sog','3QRj8drcPm4','4-zpuzt2eTQ','41OCDg8SLCo','5szETk1HOSs','65J56znZVpw','6uIR1hix_wg','7I725bslKII','8AiSriwQ6QM','8DHpRnFOPlw','8PS4KybT9KM','8VRNpTrDFJs','9u2_C3jfhB8','AHaXNPRR7rk','AJVVSNxZ9E0','AsHZLSE_UtU','aTlL14LZCnA','AtwIt8I_8VE','avx07qyEkLk','BjxaPHDHlzk','BkFeulVR6XE','BKZX7gKmFac','BMOtxqeWS7k','cMXk7cjr_tc','csA1S6kHdLw','czs-zvU05_k','D1wsanDCPUc','DBOdhW6LOBE','DBSetnWNbOM','De9zCM63beg','DkFqToesDIs','E_ptFDZa9B4','e07iRgMQHxc','EfdHPw59YYc','eM-w-P8c1rw','eWna36aY7gA','f5nwO_vsPEk','f93RCoWuzqM','g8h2KMnRQDo','GMcjn85ytFs','h0iwdWHvOds','H6S6G4j8JgM','hlEfHhqIK-Y','hmTVGjs1Y3A','HxTzcywWcXU','i6ywIzsx1NI','IjfmNWic-4U','jPuUndmzHwc','K7aofMjpQeU','kCuAERWz90M','KuK1jAp4GpY','KxrJ_1iYFyU','L8J0fqiYnJU','lYZqNA_z3Xo','matP32Sky08','mDw95b-YyEc','MGgMtR5GpTc','mh0FwfENiOs','MMxk8bLCiyg','N9cPgIlmI_w','n9dnkCKXmGw','nAz_kkffDzc','NfYK8HQRZ1Q','nGWxOykm86Y','nJ1vSsGTJ-8','NM0P5ZW5GBo','Ntmkk4prwJ8','NxIuWFGT1Mg','O5Us-qfo9PY','oRHMhBHQiU8','Ox33V4bd6ZA','pE0bN5h54b0','PhfTzT5v49w','PhKMB1EIAFw','PqQ07Y5SwIg','QCuXX1AGkzk','Qg0H3WO5Sn4','Qo8B3Eirnqc','qOzzCfBJ5yQ','qtUY064ziEA','rpHztlgROH8','rZ4Njpnlgg0','SdbNocZqaWg','sDPIKkyeSn8','sKi1gEtnSAQ','skrOd6zC05A','T7DY0FXJV18','t90Od5tt81A','t9Ssq_lulV4','TbcIGWjsQvI','tnLiUu-t-68','tOFuKgNbF1M','TRdmk6VZqIo','uaJ81czm3xA','UD-9xQZ3YM8','v1eP-DuvTY8','VGrQ749p1U4','VkzLlGJqzNg','VnOB8JqTJ1c','vO60OM9Kjlw','vza5s-IQrNE','W-DnOm1fdeg','WAGlb7u9nqE','wDDoNWYrTDc','wIiF0vcFGqo','wmfGqNFRK5M','wsLLnUkwQKU','WubV_zKI_ak','XHmZQC24zuA','XhwImas7D0c','XM3BzLwvSqY','xTNWbd3ByYs','xylvEoTYfbI','Y7lLQeBuq1g','YA8hXK7Xss8','Yvms2T_eFLU','z5mIrVvxaM0','zeHKPp8neEM','zLRxNkQqeww','zNYe45Ypjfw','zRYTFhPxiyA'); -- 스트레이키즈 아이엔 132건

UPDATE yt_channel_videos SET members=array_remove(members,'뷔')
WHERE group_ko='방탄소년단' AND coalesce(tags_manual,false)=false AND id IN ('4BeJWGoQ3t8','bJ8p-MYi4u8','dvhSxQOnAVY','h42mRQ_eqqI'); -- 방탄소년단 뷔 4건

UPDATE yt_channel_videos SET members=array_remove(members,'큐')
WHERE group_ko='더보이즈' AND coalesce(tags_manual,false)=false AND id IN ('H5Ir_mU16Zo','HUgUz4hr1sM','nHGndHXpcOY','rYdliRm6tGE','UVw8mN60EMU','UxK3gqVbxU4','VNF1LZCXd9k','Y4VQ6VLJqB8'); -- 더보이즈 큐 8건

UPDATE yt_channel_videos SET members=array_remove(members,'엔')
WHERE group_ko='빅스' AND coalesce(tags_manual,false)=false AND id IN ('4SQB8MbsJjw','6vqPcbkaT5U','bBKfg2kMkIo','EDZp0lOKG-A','Eg31O8gkhVE','HprOuH94ZR0','KyafEiS07UI','tmhy4yeIYaU'); -- 빅스 엔 8건

UPDATE yt_channel_videos SET members=array_remove(members,'엘')
WHERE group_ko='인피니트' AND coalesce(tags_manual,false)=false AND id IN ('_kKXaKKS8j8','_UgY55DJ3G8','1HZpkLwCnqA','3oen-M037-Q','6y7jxHtjXXU','7T6f_cW8-ME','7WXigwxQa_I','8lhNc0aL_Es','bCiWFUry3Es','cPIh7tVgFcg','fQ3sNGV0_9U','GAoFUnXgwF0','hA4LDFT_dMI','hfcSn1c9w6A','HOnRNp2_vUY','M2zO-YkSaVU','M8D1vrMC0fw','MS906yDU5DQ','N5LOESZEglE','NB72YRN8B2c','Nn-8Gj-GQhc','OENat_b2MyQ','QsLW3GHNlYk','rrJsKbsepHI','RugIKGf6igY','U_gkbql72jI','VIlpeIRqE1Q','vX4tTSR6cgE','WIm_S8M-4i0','Wt_o_kld2jw','YbfujfJMO_0','Yf1GYorLwEc'); -- 인피니트 엘 32건

UPDATE yt_channel_videos SET members=array_remove(members,'Y')
WHERE group_ko='골든차일드' AND coalesce(tags_manual,false)=false AND id IN ('BmK2ihX6uTk'); -- 골든차일드 Y 1건

-- ② 그 그룹 영상이 아닌데 그룹까지 잘못 들어간 것 → '무관'으로 숨기고 검수 목록에 올림(needs_review). 되돌리기 쉬움.
--    (영어 "Team"이 &TEAM으로, "#k_link_Festival"·성씨 "조"가 앤팀 케이·조로, "IN SEONG"·"In A Minute"가 스키즈 I.N으로 잡혔던 것)
UPDATE yt_channel_videos SET content_flag='무관', flag_source='auto', flagged_at=now(), needs_review=true
WHERE content_flag IS NULL AND coalesce(tags_manual,false)=false AND id IN ('86PndC_Kg1Y','c9aroBLDD30','cqAcEICSfUo','CuX4XUZgBZE','Fp4WQSGdGJs','iuZ1iFu_oqQ','k8_ylJXjtYQ','KY_Npf1ATR0','kZxxWOiWTFU','MeFmMhwxq4s','O9Fx5yTctSQ','PtrxP_PNey4','RyI880srjUU','SJwz9TCeyEo','SROBEXTFkqs','ucwNjimiyXU','wjdHCa3gb5I','ZAPNpOd40mM','ZlmM7OCHQsQ','0jX-1dNmJYE','BjxaPHDHlzk','czs-zvU05_k','GMcjn85ytFs','HxTzcywWcXU','sDPIKkyeSn8','_tVpNqMVzYU','-_LEHHHoaTI','78p1hi-DJpY','8IlPKnZwQmI','8p87eW6UpzA','9ZMlZAxy-Ow','crv8xoTcUvI','e954uZEFfrI','Ggf4D4XOhFw','H8veVEgsCEY','HP_6ckPW774','hv2FfxVE1gI','jUoUN14Cln0','MHkvchWC8I0','MMXiszhCq1M','oLTvYV4vGJY','pwPeCJR7lXY','QOHQUNsUGhg','rmFhhAoqiM8','uTIdYNP0BCM','V65rG1P7Ztw','viBk6xou7HI','wNvU2x7XqnM','xbQYGicrvRc','xeoMsCjCkC0','ZyxwvY24hSM'); -- 51건

-- ③ 그룹이 실제로는 다른 그룹인 것 2건(언더나인틴 멘토 무대)
UPDATE yt_channel_videos SET group_ko='이엑스아이디', members='{}' WHERE id='vyAk6y4DgTE' AND group_ko='앤팀' AND coalesce(tags_manual,false)=false;
UPDATE yt_channel_videos SET group_ko='슈퍼주니어', members='{}' WHERE id='Yk5CEnfcMqg' AND group_ko='앤팀' AND coalesce(tags_manual,false)=false;

-- 확인: 둘 다 0이면 반영 완료
SELECT count(*) AS 남은_멤버 FROM yt_channel_videos WHERE coalesce(tags_manual,false)=false AND (
  (group_ko='앤팀' AND '케이'=ANY(members) AND id IN ('_CZ12TCfv1s','_gGvm0rbkZY','_kXFjDK0gJA','_ObqB6W4_qo','_P9WzjKJh2o','-7knB3g-KTs','0IPsZPYEec4','0J1IUUUnO4s','15uuM8nfbA4','2e7s8OnPvP4','2ee-YbDSnag','3FilUUeJ4HM','3hVBxqgVHAM','3oRu1kHwx5c','4cm4sLRhoeY','4F-gC-MAor8','4rtKR3JMmFE','4UYwrVJ0eT8','4wMJcNMyV6I','5AYRPEcw80k','5gWhJZjPazo','5LsZIyJ8oqU','5rSWjiR3_y8','5ZnCgy06U1I','6rEl5U5JqHs','6T06VuV7IZE','6umPnX5Pzeo','6WFtkaYWDs0','72MuxcOBqds','73doY-73YvA','7UZdg-8L21U','86PndC_Kg1Y','8Atvp3USZko','9N5wdArLDrk','9NfeboJr-2Y','A2oYKwuYcXY','aaVoo4XqgKQ','aD831iUlAuA','aKZ_dHruS-U','aNskz32aEFc','aTI81vfuqMk','b6PnbG_RJs4','B9ZUf-Wiiu4','bilseyGtOcE','BLxpiksZ37I','Bn2zDywVE58','BOm3_TWXf2k','C6ItJrSQl8I','c6OL4mSRbRs','c9aroBLDD30','CaUucuDiAzs','CDpMuPXqebo','cmUgb6Zer74','cqAcEICSfUo','CuX4XUZgBZE','CVk294tnqXg','d4jijda4PN4','d8zSD-P6pDU','DlbsOYcnmj0','dlY99v5nBZI','ean9qb2Xtpc','edtuzRbdlRo','eSHQ84O2tHE','ESZ9RWQB5uw','Fl5bP_dm6OM','Fp4WQSGdGJs','FQ3rbj9ooUA','Fs7w2RorHM0','FVBFTIxuBrw','GLqpjXxvWLY','h-OMxqR4jKE','HeyNJjzXZfw','HOqUqIkWz4Q','iuZ1iFu_oqQ','j0PsjK0t-sU','j27otWqUrDo','jEBKgfEJeNc','JfJY4GXsoDQ','jkK0myfvzik','jlhim4-9Ytk','jobACoI6cFA','jVvOI38unKw','jZNaTQnSSqk','k8_ylJXjtYQ','kAux_S35Idg','kEK77dbMxkg','KEXyYdn8QWs','KkW1kiCQbRQ','kmg8pg9XNzg','KQ9VW6I1heY','KY_Npf1ATR0','kZxxWOiWTFU','L_-gGvyXUnU','L_SuPOYDOhw','l_xlDEXhQrg','l0AJGMeAiUY','l1DXoCdMelM','L3ijT3JHZSk','LaHqCAJsslw','LfELh0br03Y','LIvzRzP5N0o','ls_WcTlosOY','lVQY4GCHmE4','LYblQhENP0I','m_SeKePaWgE','MeFmMhwxq4s','mHT0sv6Lc4o','mQ27axseZ4w','nAE4-_DB7sw','NlJXvrX1tq0','nPV7fu9v2pk','O3p-M4Rv2x4','o8T-OfTi9Yk','O9Fx5yTctSQ','obKgmRrzdWI','oKe3tuGi9FA','OKWBYO6xWdc','OMi5Rul0daM','OmMje8KSnUE','Or8SKB4daOI','P_89qu-3rnQ','PcF2p6I5odg','pF4Yd2J4Hvs','PkCOMcIf1LE','PtrxP_PNey4','pvFebW8JFdI','pY-CYCHDvYo','PZI4HxHcD0g','q_Rcw0NyHrk','qtqe_KkUAis','qtQn-mvHLQI','QU0DzP-3b30','r_ck_kqUHsQ','R5F3av-MI8g','r95M_tT5Mqo','rBtRT52qS6I','RgSURPXnEMo','RyI880srjUU','s4IkTnKd_fo','sgkF2GipOsM','SJwz9TCeyEo','sNbt9ljCWp4','sR9_UYW_h30','SROBEXTFkqs','SSklxxMRMHk','T_FlgcuDcw8','t1Iu9ayDBn8','TaYyq5qquK0','tGZmjuR6L_Y','ThTRCkwttHw','TuN-77wRAdQ','u_aw7TyL50k','u8ELWjfnOMg','UbBEnJ0b3dU','ucwNjimiyXU','UtlFWAqCHUg','V7rWHlVIQYs','vBA74Pcrylg','VLh3soclqyQ','VrgRUTq70ns','w3_ICsFrM7c','w7YZ4zH_TLs','wHF16YAuoRw','wjdHCa3gb5I','wJijySQ8jmQ','wXHzeEAh7_Y','x2wVFSRldAs','x9BkVovVIQA','xA2VZzEjhvs','Xd7udIFWUd4','XHNHTTTCIzg','YB5JECBe4S8','YG5JERSP9g8','YJJqd06VcVE','yUVh4wptfnU','yW_-NyPcaCE','z_9v-fbJ53s','ZAPNpOd40mM','ZGIIVImmQPI','ZlmM7OCHQsQ','zSJB7uJ_Vts','zSWquyeXGJg'))
  OR
  (group_ko='스트레이키즈' AND '아이엔'=ANY(members) AND id IN ('_UBaL2w57vg','-NTjD_Z6zkw','0im5OGhn5_c','0jX-1dNmJYE','0ONxtrsybIM','0QKhAdN-keY','0UOiW50CE6g','1inY1P4Xn6Y','1Vy82Zj4KIw','2MoUqq3bDao','30OpgokL5iY','3FAHOyL0sog','3QRj8drcPm4','4-zpuzt2eTQ','41OCDg8SLCo','5szETk1HOSs','65J56znZVpw','6uIR1hix_wg','7I725bslKII','8AiSriwQ6QM','8DHpRnFOPlw','8PS4KybT9KM','8VRNpTrDFJs','9u2_C3jfhB8','AHaXNPRR7rk','AJVVSNxZ9E0','AsHZLSE_UtU','aTlL14LZCnA','AtwIt8I_8VE','avx07qyEkLk','BjxaPHDHlzk','BkFeulVR6XE','BKZX7gKmFac','BMOtxqeWS7k','cMXk7cjr_tc','csA1S6kHdLw','czs-zvU05_k','D1wsanDCPUc','DBOdhW6LOBE','DBSetnWNbOM','De9zCM63beg','DkFqToesDIs','E_ptFDZa9B4','e07iRgMQHxc','EfdHPw59YYc','eM-w-P8c1rw','eWna36aY7gA','f5nwO_vsPEk','f93RCoWuzqM','g8h2KMnRQDo','GMcjn85ytFs','h0iwdWHvOds','H6S6G4j8JgM','hlEfHhqIK-Y','hmTVGjs1Y3A','HxTzcywWcXU','i6ywIzsx1NI','IjfmNWic-4U','jPuUndmzHwc','K7aofMjpQeU','kCuAERWz90M','KuK1jAp4GpY','KxrJ_1iYFyU','L8J0fqiYnJU','lYZqNA_z3Xo','matP32Sky08','mDw95b-YyEc','MGgMtR5GpTc','mh0FwfENiOs','MMxk8bLCiyg','N9cPgIlmI_w','n9dnkCKXmGw','nAz_kkffDzc','NfYK8HQRZ1Q','nGWxOykm86Y','nJ1vSsGTJ-8','NM0P5ZW5GBo','Ntmkk4prwJ8','NxIuWFGT1Mg','O5Us-qfo9PY','oRHMhBHQiU8','Ox33V4bd6ZA','pE0bN5h54b0','PhfTzT5v49w','PhKMB1EIAFw','PqQ07Y5SwIg','QCuXX1AGkzk','Qg0H3WO5Sn4','Qo8B3Eirnqc','qOzzCfBJ5yQ','qtUY064ziEA','rpHztlgROH8','rZ4Njpnlgg0','SdbNocZqaWg','sDPIKkyeSn8','sKi1gEtnSAQ','skrOd6zC05A','T7DY0FXJV18','t90Od5tt81A','t9Ssq_lulV4','TbcIGWjsQvI','tnLiUu-t-68','tOFuKgNbF1M','TRdmk6VZqIo','uaJ81czm3xA','UD-9xQZ3YM8','v1eP-DuvTY8','VGrQ749p1U4','VkzLlGJqzNg','VnOB8JqTJ1c','vO60OM9Kjlw','vza5s-IQrNE','W-DnOm1fdeg','WAGlb7u9nqE','wDDoNWYrTDc','wIiF0vcFGqo','wmfGqNFRK5M','wsLLnUkwQKU','WubV_zKI_ak','XHmZQC24zuA','XhwImas7D0c','XM3BzLwvSqY','xTNWbd3ByYs','xylvEoTYfbI','Y7lLQeBuq1g','YA8hXK7Xss8','Yvms2T_eFLU','z5mIrVvxaM0','zeHKPp8neEM','zLRxNkQqeww','zNYe45Ypjfw','zRYTFhPxiyA'))
  OR
  (group_ko='방탄소년단' AND '뷔'=ANY(members) AND id IN ('4BeJWGoQ3t8','bJ8p-MYi4u8','dvhSxQOnAVY','h42mRQ_eqqI'))
  OR
  (group_ko='더보이즈' AND '큐'=ANY(members) AND id IN ('H5Ir_mU16Zo','HUgUz4hr1sM','nHGndHXpcOY','rYdliRm6tGE','UVw8mN60EMU','UxK3gqVbxU4','VNF1LZCXd9k','Y4VQ6VLJqB8'))
  OR
  (group_ko='빅스' AND '엔'=ANY(members) AND id IN ('4SQB8MbsJjw','6vqPcbkaT5U','bBKfg2kMkIo','EDZp0lOKG-A','Eg31O8gkhVE','HprOuH94ZR0','KyafEiS07UI','tmhy4yeIYaU'))
  OR
  (group_ko='인피니트' AND '엘'=ANY(members) AND id IN ('_kKXaKKS8j8','_UgY55DJ3G8','1HZpkLwCnqA','3oen-M037-Q','6y7jxHtjXXU','7T6f_cW8-ME','7WXigwxQa_I','8lhNc0aL_Es','bCiWFUry3Es','cPIh7tVgFcg','fQ3sNGV0_9U','GAoFUnXgwF0','hA4LDFT_dMI','hfcSn1c9w6A','HOnRNp2_vUY','M2zO-YkSaVU','M8D1vrMC0fw','MS906yDU5DQ','N5LOESZEglE','NB72YRN8B2c','Nn-8Gj-GQhc','OENat_b2MyQ','QsLW3GHNlYk','rrJsKbsepHI','RugIKGf6igY','U_gkbql72jI','VIlpeIRqE1Q','vX4tTSR6cgE','WIm_S8M-4i0','Wt_o_kld2jw','YbfujfJMO_0','Yf1GYorLwEc'))
  OR
  (group_ko='골든차일드' AND 'Y'=ANY(members) AND id IN ('BmK2ihX6uTk')));
SELECT count(*) AS 안숨긴것 FROM yt_channel_videos WHERE content_flag IS NULL AND coalesce(tags_manual,false)=false AND id IN ('86PndC_Kg1Y','c9aroBLDD30','cqAcEICSfUo','CuX4XUZgBZE','Fp4WQSGdGJs','iuZ1iFu_oqQ','k8_ylJXjtYQ','KY_Npf1ATR0','kZxxWOiWTFU','MeFmMhwxq4s','O9Fx5yTctSQ','PtrxP_PNey4','RyI880srjUU','SJwz9TCeyEo','SROBEXTFkqs','ucwNjimiyXU','wjdHCa3gb5I','ZAPNpOd40mM','ZlmM7OCHQsQ','0jX-1dNmJYE','BjxaPHDHlzk','czs-zvU05_k','GMcjn85ytFs','HxTzcywWcXU','sDPIKkyeSn8','_tVpNqMVzYU','-_LEHHHoaTI','78p1hi-DJpY','8IlPKnZwQmI','8p87eW6UpzA','9ZMlZAxy-Ow','crv8xoTcUvI','e954uZEFfrI','Ggf4D4XOhFw','H8veVEgsCEY','HP_6ckPW774','hv2FfxVE1gI','jUoUN14Cln0','MHkvchWC8I0','MMXiszhCq1M','oLTvYV4vGJY','pwPeCJR7lXY','QOHQUNsUGhg','rmFhhAoqiM8','uTIdYNP0BCM','V65rG1P7Ztw','viBk6xou7HI','wNvU2x7XqnM','xbQYGicrvRc','xeoMsCjCkC0','ZyxwvY24hSM');

-- ② 대상 목록
--   86PndC_Kg1Y [앤팀] Expensive Ice cream that even members of the same team don't recognize.  [SCHOOL ATTACK 20
--   c9aroBLDD30 [앤팀] Team B of I-LANDER ON&OFF 온도차🌡내가 좋아하는 모드는? #IWALY #ILAND2 #아이랜드2 #Mnet #엠넷
--   cqAcEICSfUo [앤팀] 아니,, 아직 못 놓아줘요,,,🤛(질척) #shorts #visitkoreayear #한국방문의해 #k_link_Festival
--   CuX4XUZgBZE [앤팀] 남들과 다른 ITZY걸크러쉬에 홀리는 중🌀 #shorts #visitkoreayear #한국방문의해 #k_link_Festival
--   Fp4WQSGdGJs [앤팀] Who's the real JEONG SEWOON out of 'TEAM JEONG SEWOON'?! [MBTI of my members]
--   iuZ1iFu_oqQ [앤팀] Airport Baby Ensemble Team, Airport Baby [2024 대한민국 대중문화예술상]
--   k8_ylJXjtYQ [앤팀] [#2023MAMA/ROAD TO MAX]  Only 1 Team for MAMA AWARDS Special stage!
--   KY_Npf1ATR0 [앤팀] 오늘도 민호를 향해 Runaway 중🏃🏻 #shorts #visitkoreayear #한국방문의해 #k_link_Festival
--   kZxxWOiWTFU [앤팀] Team B of I-LANDER 지원자별 춤선 #IWALY #ILAND2 #아이랜드2 #Mnet #엠넷
--   MeFmMhwxq4s [앤팀] 에스파는 CD를 씹어 먹어,, 그냥 라이브 최고,,🎤👍 #shorts #visitkoreayear #한국방문의해 #k_link_Festival
--   O9Fx5yTctSQ [앤팀] 음색이 다했다,,진짜,,내 귀 호강하는 중❤️‍🔥 #shorts #visitkoreayear #한국방문의해 #k_link_Festival
--   PtrxP_PNey4 [앤팀] Team A of I-LANDER ON&OFF 온도차🌡내가 좋아하는 모드는? #IWALY #ILAND2 #아이랜드2 #Mnet #엠넷
--   RyI880srjUU [앤팀] 고마워(Thank You) - 조관우(JO KWAN WOO) | SBS 251207 방송
--   SJwz9TCeyEo [앤팀] Team A of I-LANDER 지원자별 춤선 #IWALY #ILAND2 #아이랜드2
--   SROBEXTFkqs [앤팀] 🥒아삭한 케미 팡팡🥒 오이소박이 '향수 뿌리지마' 사전 녹화 비하인드 (Team 오이소박이 잘했어요)
--   ucwNjimiyXU [앤팀] Jo Jung Min, Ready Q [THE SHOW 190507]
--   wjdHCa3gb5I [앤팀] Jo a seo (조아서) - You are mine (가시나요) @인기가요 inkigayo 20240428
--   ZAPNpOd40mM [앤팀] 그냥,, 달달해요 이 노래 가사,,음색,,조명,, 비주얼,,모든게 다,, #shorts #visitkoreayear #한국방문의해 #k_link_Festival
--   ZlmM7OCHQsQ [앤팀] 시원시원한 기럭지로,, 내 화면은 라이즈로 꽉 차,,❤️ #shorts #visitkoreayear #한국방문의해 #k_link_Festival
--   0jX-1dNmJYE [스트레이키즈] [쇼챔1분직캠] 인성 (IN SEONG)의 ＜Mute is Off＞♬ #Mute_is_Off #IN_SEONG
--   BjxaPHDHlzk [스트레이키즈] In A Minute(인어미닛)의 비하인드 🎙️ #In_A_Minute #인어미닛 #BEHIND #비하인드
--   czs-zvU05_k [스트레이키즈] [OFF Air 선공개] 🤍𝑯𝒆𝒂𝒓𝒕 𝑨𝒕𝒕𝒂𝒄𝒌 🤍In A Minute🤍.*･｡ﾟ #In A Minute #인어미닛 #오프에어 #off
--   GMcjn85ytFs [스트레이키즈] In A Minute(인어미닛)의 ＜Broken Doll＞🎞️ #In_A_Minute #인어미닛 #Broken_Doll #DANCE_PERFORMANCE #댄스
--   HxTzcywWcXU [스트레이키즈] [쇼챔1분직캠] In A Minute JAEJUN(인어미닛 재준)의 ＜How We Do＞♬ #In_A_Minute #재준
--   sDPIKkyeSn8 [스트레이키즈] In A Minute(인어미닛)의 토크쇼 🎙️ #In_A_Minute #인어미닛 #MUSIC_TALK #뮤직_토크
--   _tVpNqMVzYU [앤팀] Hoodie Girls Team A vs B
--   -_LEHHHoaTI [앤팀] [Triple iz] Dita, Aria and E.JI – The Ultimate Team? | Road To Debut EP.6
--   78p1hi-DJpY [앤팀] CROWN Team A vs B
--   8IlPKnZwQmI [앤팀] DAISY Team A vs B
--   8p87eW6UpzA [앤팀] [#언더커버미쓰홍 14화] 한민증권 주식 잘 먹었습니다~💰 최강 케미로 강 회장 무너뜨리는 TEAM 여의도 해적단🏴‍☠️
--   9ZMlZAxy-Ow [앤팀] SBS 글로벌 보이 그룹 오디션 [유니버스 리그] 🔷TEAM BEAT 감독 공개🔷
--   crv8xoTcUvI [앤팀] TEAM #프로보노 의 활약은 계속된다✨
--   e954uZEFfrI [앤팀] 🧳예고ㅣ의지는 충만, 예능은 그만.. 시련 속 TEAM '카지노' 고객님들ㅣ🧳출장십오야2 X 카지노2
--   Ggf4D4XOhFw [앤팀] [SUB] 슈퍼 히로인의 재림! Team 발레리나 | EP.10 발레리나 전종서&김지훈&박유림 | 살롱드립2
--   H8veVEgsCEY [앤팀] [가요대제전] TEAM 20’S – 나에게로 떠나는 여행 (원곡 : 버즈) FullCam | 2025 GayoDaejejeon | MBC251231
--   HP_6ckPW774 [앤팀] [#프로보노 11화] 우린 절대 포기하지 않아🥺 조작 재판 사건 오해 풀리고 다시 만난 TEAM 프로보노
--   hv2FfxVE1gI [앤팀] CHOI HYUNWOOK'S TEAM UNDERARMOUR
--   jUoUN14Cln0 [앤팀] TEAM 해적단과 한 팀이 된 기특 강쥐 노라🐶💛 #언더커버미쓰홍
--   MHkvchWC8I0 [앤팀] SBS 글로벌 보이 그룹 오디션 [유니버스 리그] ♦️TEAM Rhythm 감독 공개♦️
--   MMXiszhCq1M [앤팀] Diss papa Team A vs B
--   oLTvYV4vGJY [앤팀] [#프로보노 최종화] 억울한 사람들을 위한 새로운 출발🙌 TEAM 프로보노다운 엔딩✨
--   pwPeCJR7lXY [앤팀] 5 vs 5 댄스 배틀 🔥TEAM 김도이 vs TEAM 유논🔥
--   QOHQUNsUGhg [앤팀] [HOT] the stage of 'Be Mine' team,언더 나인틴 20190112
--   rmFhhAoqiM8 [앤팀] 나연이가 우리 호스트라 행복했어🥹💕🫳 -TEAM TRICKKODE-
--   uTIdYNP0BCM [앤팀] SBS 글로벌 보이 그룹 오디션 [유니버스 리그] ❇️TEAM GROOVE 감독 공개❇️
--   V65rG1P7Ztw [앤팀] [2025 MBC 가요대제전] Team 20's - Journey for Myself (나에게로 떠나는 여행), MBC 251231 방송
--   viBk6xou7HI [앤팀] [2025 MBC 가요대제전] TEAM 20'S 20살 되다 #TEAM20S #shorts
--   wNvU2x7XqnM [앤팀] Team 우주를 줄게에게 필름카메라를 드려보았다
--   xbQYGicrvRc [앤팀] [트윈 미러쇼/6회] 'TEAM 10년생 모여' 키야의 도파민 Pop Off 고등학교 생활 #MnetPlus_Original | Mnet 260820 방송
--   xeoMsCjCkC0 [앤팀] 🔥엄중한 시국(?) 회식 현장🔥 ??? : 그게 출연자가 할 말이냐고ㅠㅠ💦 회식도 콘텐츠가 되는 TEAM 냉부 레전드 모음｜냉장고를 부탁해｜JTBC 2607
--   ZyxwvY24hSM [앤팀] [HOT] The FAKE LOVE Team Wins First Round  ,언더 나인틴 20190112
