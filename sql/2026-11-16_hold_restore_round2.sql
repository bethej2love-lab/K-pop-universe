-- 2026-11-16 풀린 보류 복구 2차 — 넥스지 하루·B1A4 바로·에이티즈 우영·샤이니 키·스테이씨 아이사·빌리 수현·투어스 지훈·뉴진스 다니엘/민지·라이즈 소희·아일릿 민주 (제목 378줄 읽고 판정)
-- 보류=manual / 무관=우주 밖 / 이동=주인이 확실한 것(2PM 장우영·악뮤 이수현·엘리스·BTS·EXID) / 샤이니 태민 직캠 4건은 키→태민. 되돌리기: _undo.sql
create table if not exists bak_20261116_rest2 as select id, group_ko, members, with_members, with_groups, content_flag, flag_source, now() as backed_at from yt_channel_videos where id in ('BKGx8_PMQuY','_-U8hdtUqT0','TyPQ2I6CRH8','9yE3i7wCfJI','6PfU_ytxbPw','uUAuI4m09-Y','wCSJA3FAs14','WDWIICHKHm8','sISrk5xL1Ys','j9hdXHFllHE','8Q5zTEdYJaI','4I_R1XJ1chc','zplhfEtbX8c','tw2oePIJKtg','KlCgqe87wdc','VS1oi3Ol6iQ','hVc1CSExvYc','UtS7KHEY6Ig','gjx6vMhJtBY','M_cCKetdvSc','VlRCcY3Plh0','C6dRiYAzx4U','BdXLYu4uz1U','fXkE7Tn1gbc','82p0baK8E3E','853fZgIrjLk','T-1BRqsPeL4','2NbmzOmFhCc','5DA4AiVOK4g','08lw99PknZI','dQ_CVlIG60M','6zgdcHTo-lI','WgrBuK2UwRc','Dkx-iwPN4RU','ESCQJfYq19E','I1QrqOSQfak','iVu6WqpZDUk','jaHHDsk2OKE','jRCh4cjm0fs','jscEr4vaYo4','O6sXSM5m45w','nA3z1EPNZXc','Mkq5vmnEqx4','3smqUtu77N0','N1FODQvN83U','cL2kGhcPTiE','Ow4k2ikzpfU','0tFK_Rkm9Pg','HwNMM5RSHCw','saev7_5Oe1A','SBXRhpupQbs','sc4iaR2B30I','W-yGNRQrG6M','sdsDzgvm_F8','TV30MhKsNNw','TX4QB3XWuuA','U2FihfG0ws8','UrUYEnHW2yY','KzgXdy0XF6c','vhJBrm_m0Dw','VOT7vm6jFz0','XBJtM6NFoQw','A9IF5SyvbkY','JpcTCtwzkgo','Rsaek2WNJpI','ZGiV9EPZW8Q','ZkghMrMtrmM','Zn_9pSVtbng','Zr4aroMe2cg','wS5-2E24-R8','I5vQ3ew2el4','vjPZB_vXggU','jFgmUJ99BsI','4T2wJbhBGrc','SANkDQhHdFI','kcf11cdMojQ','uzSIlYlHT4k','LnLbc13WeAA','3jjfWk_e4qo','Q8bkNV7RebE','ClM4RT8Cr-Y','i2tHWr0erGY','zIvYoftQgjw','ci0Vw-AfHQ4','6wLmbQ--E18','-NylMVk1A_0','jC4d4BLn_mw','Fy0iiLrjdn8','8JH4f_xqJRs','NV2dJ7wS8gw','pxWFho99iCY','OOLcyuNq4BU','6dxqNzB_1Pw','9Eb1S1V8B4k','do69oi0dKjo','KQro_4o4xX0','9QXQ9wWMJ-w','7HdTPKR_2rI','goQX1Xo6348','GkN-RSAKoYA','0X9FdQb3ryk','tDD-xeGrUhg','b_BgocN2I3Q','lZYhZ7LCKyM','2g6ddttJzOM','4PLc2VDdg-o','5C8yqWvv4UE','5OKvowhA-VE','Dpm5-eMyq9s','fgxqtFvVFWQ','KG4Wu1XAH54','bARN5U6MRL4','qAOazsoDq7o','Qj7OBxT7JYg','6LLGooT6-mI','CxI0QO2gkWw','wBRipF5X5Vg','Xh3Nv9YH0tU','xq0fJnzqYjU','YFuohtfZ2-I','i3LI1rbErw0','IlGLxCRGTO8','3k_UCKd69l4','ZLApYs6rwhI','ZAdDNyZysP4','E8ravsAF6EY','hBlaM7Wvt-c','jO_0VeLkT_M','jsv6tRXu5DU','Kyy8u8vvA1M','qb7K2_hxLw4','bdrSB8ZjTao','wcxfrCPkVtA','riuHSyglU0g','y-4Y9X_9FSY','S8inm6TScTg','ZFBUixIzRxQ','A7Be-usAIkw','3E4Hih4iNK8','GqGCVGEmyC4','daE5GGWqrPQ','-sQp4Aw-zuc','ZeA9AdICTiE','wNVtzTS9Iaw','Kt8IPnq6VTQ','aA8H0FnKCtg','A1NxC83Ug8k','3Gm04ysz4iU','ksWrNnV5xn0','eiH9xav_LSU','IYacWnjPJJ8','DYi4ZGCbhig','n6d9iQ53UHE','AqLEMpzq2Eo','ZYGQ5FJzO-Q','zpsZdRaPltk','mwkVESbKsO4','-4FTDZh4cY8','s4OrCSrIxt4','_hGonrNVFmU','cDWFW3sSV9s','CDWOT8M7Lhk','fxrKY9SbKhc','G68TjWKxb1w','HMIJc9S23xw','qEtFbYuIqkE','7YlXowZKJSE','dqsuZQCYayI','svE6AoAgvbU','8W6gjOARQy4','Sio1Fmn7oeU','UeKVjZQcCdw','7vzCMqPRBc8','WIdOaRnRGNU','XK2F_Uvhf40','DAfKQI_4qDs','XxqWnWW45dU','8xE1byQukjo','jdhZSJH_YXw','42Bn5UWe4GM','44gVytdWGv8','6ELL8cbaf5s','1pXHKiaFl9o','cGYJNwNIj_E','V-MG6cTv_BI','FRoIE32MNkY','26PWQkUn9mc','gwL5dff00mk','lILNRUVD8p4','5-XisKGSFuU','oupAEM1Mbr4','kKT_nnO66Bk','EnyTgjoPOHU','wDW41bjx7CE','Z4mibFB08hc','VnoQpknZgYU','pBosY6BtUk0','aFgY_-84bzk','TUK0dXMTDcs','ThCo9YTwKko','R6SK5Vi1TZE','jTnaIjqbltE','6mAulsMu_ic','gYkDmaUlRUY','oGnwxC_p_yE','sf_3dplwNAM','a4pDBdFOtJQ','die_pquSzE4','FIxNSMWDp4M','GrDe1PWcGiI','HdS-wNfPqdg','OqHPhjGoXZM','fDIsDh8ZzEk','NJTA0hlCrnE','Pzef7GmkrkA','XIblObuQVps','G4F4rgqP0CE','v_dQPfu68WM','wTrDQzLCjEw','j4cfbMDRsRY','xwWLdMff7Hc','9XlLn2XA3kk','CZyTwDEOMyo','rg0PChlqrjM','gh62zNYmSsc','ETebYQ_YAY0','Hmg9vUlTdW4','cbGGP43GFu0','0bFUkLT_7gY','nYtmoY5UmGk','F8I-tHuSeuA','N54W5RqYjos','7sYUptkBWZU','0nTN_PY6hTE','08_7lvKvd18','6ivur47rL5I','cUCPPQn01-I','mZe1GEWxw3o','oEDvY-l5JKc','r-1Dupbp_Xo','oboWMh1rzKQ','Q-saoLVcvFM','RLJqNiIEe5g','VxvDMSS063c','rOuzM_nCw4c','VEgT2yGM2JQ','9gL7N2aqaZ0','WQsAcAMxLUc','nnE6XiFr93s','i1rB-TfEvk4','p-8c0Iqn1Vc','-3dU4Dmrebo','GpBMrIbGqSc','lF5UyG35qoU');
alter table bak_20261116_rest2 enable row level security;

-- 보류 넥스지 하루 6
update yt_channel_videos set content_flag='보류', flag_source='manual' where id in ('_-U8hdtUqT0','TyPQ2I6CRH8','9yE3i7wCfJI','uUAuI4m09-Y','wCSJA3FAs14','WDWIICHKHm8') and group_ko='넥스지' and content_flag is null and tags_manual is not true;

-- 보류 뉴진스 다니엘 1
update yt_channel_videos set content_flag='보류', flag_source='manual' where id in ('daE5GGWqrPQ') and group_ko='뉴진스' and content_flag is null and tags_manual is not true;

-- 보류 뉴진스 민지 6
update yt_channel_videos set content_flag='보류', flag_source='manual' where id in ('-sQp4Aw-zuc','ZeA9AdICTiE','wNVtzTS9Iaw','Kt8IPnq6VTQ','aA8H0FnKCtg','A1NxC83Ug8k') and group_ko='뉴진스' and content_flag is null and tags_manual is not true;

-- 보류 라이즈 소희 80
update yt_channel_videos set content_flag='보류', flag_source='manual' where id in ('3Gm04ysz4iU','ksWrNnV5xn0','eiH9xav_LSU','IYacWnjPJJ8','DYi4ZGCbhig','n6d9iQ53UHE','AqLEMpzq2Eo','ZYGQ5FJzO-Q','zpsZdRaPltk','mwkVESbKsO4','-4FTDZh4cY8','s4OrCSrIxt4','_hGonrNVFmU','cDWFW3sSV9s','CDWOT8M7Lhk','fxrKY9SbKhc','G68TjWKxb1w','HMIJc9S23xw','qEtFbYuIqkE','7YlXowZKJSE','dqsuZQCYayI','svE6AoAgvbU','8W6gjOARQy4','Sio1Fmn7oeU','UeKVjZQcCdw','7vzCMqPRBc8','WIdOaRnRGNU','XK2F_Uvhf40','DAfKQI_4qDs','XxqWnWW45dU','8xE1byQukjo','jdhZSJH_YXw','42Bn5UWe4GM','44gVytdWGv8','6ELL8cbaf5s','1pXHKiaFl9o','cGYJNwNIj_E','V-MG6cTv_BI','FRoIE32MNkY','26PWQkUn9mc','gwL5dff00mk','lILNRUVD8p4','5-XisKGSFuU','oupAEM1Mbr4','kKT_nnO66Bk','EnyTgjoPOHU','wDW41bjx7CE','Z4mibFB08hc','VnoQpknZgYU','pBosY6BtUk0','aFgY_-84bzk','TUK0dXMTDcs','ThCo9YTwKko','R6SK5Vi1TZE','jTnaIjqbltE','6mAulsMu_ic','gYkDmaUlRUY','oGnwxC_p_yE','sf_3dplwNAM','a4pDBdFOtJQ','die_pquSzE4','FIxNSMWDp4M','GrDe1PWcGiI','HdS-wNfPqdg','OqHPhjGoXZM','fDIsDh8ZzEk','NJTA0hlCrnE','Pzef7GmkrkA','XIblObuQVps','G4F4rgqP0CE','v_dQPfu68WM','wTrDQzLCjEw','j4cfbMDRsRY','xwWLdMff7Hc','9XlLn2XA3kk','CZyTwDEOMyo','rg0PChlqrjM','gh62zNYmSsc','ETebYQ_YAY0','Hmg9vUlTdW4') and group_ko='라이즈' and content_flag is null and tags_manual is not true;

-- 보류 비원에이포 바로 5
update yt_channel_videos set content_flag='보류', flag_source='manual' where id in ('sISrk5xL1Ys','j9hdXHFllHE','4I_R1XJ1chc','zplhfEtbX8c','KlCgqe87wdc') and group_ko='비원에이포' and content_flag is null and tags_manual is not true;

-- 보류 빌리 수현 4
update yt_channel_videos set content_flag='보류', flag_source='manual' where id in ('b_BgocN2I3Q','Dpm5-eMyq9s','6LLGooT6-mI','i3LI1rbErw0') and group_ko='빌리' and content_flag is null and tags_manual is not true;

-- 보류 샤이니 키 1
update yt_channel_videos set content_flag='보류', flag_source='manual' where id in ('i2tHWr0erGY') and group_ko='샤이니' and content_flag is null and tags_manual is not true;

-- 보류 스테이씨 아이사 18
update yt_channel_videos set content_flag='보류', flag_source='manual' where id in ('zIvYoftQgjw','ci0Vw-AfHQ4','6wLmbQ--E18','-NylMVk1A_0','jC4d4BLn_mw','Fy0iiLrjdn8','8JH4f_xqJRs','NV2dJ7wS8gw','pxWFho99iCY','OOLcyuNq4BU','6dxqNzB_1Pw','9Eb1S1V8B4k','do69oi0dKjo','KQro_4o4xX0','9QXQ9wWMJ-w','7HdTPKR_2rI','goQX1Xo6348','GkN-RSAKoYA') and group_ko='스테이씨' and content_flag is null and tags_manual is not true;

-- 보류 아일릿 민주 26
update yt_channel_videos set content_flag='보류', flag_source='manual' where id in ('cbGGP43GFu0','0bFUkLT_7gY','nYtmoY5UmGk','F8I-tHuSeuA','N54W5RqYjos','7sYUptkBWZU','0nTN_PY6hTE','08_7lvKvd18','6ivur47rL5I','cUCPPQn01-I','mZe1GEWxw3o','oEDvY-l5JKc','r-1Dupbp_Xo','oboWMh1rzKQ','Q-saoLVcvFM','RLJqNiIEe5g','VxvDMSS063c','rOuzM_nCw4c','VEgT2yGM2JQ','9gL7N2aqaZ0','WQsAcAMxLUc','nnE6XiFr93s','i1rB-TfEvk4','p-8c0Iqn1Vc','-3dU4Dmrebo','GpBMrIbGqSc') and group_ko='아일릿' and content_flag is null and tags_manual is not true;

-- 보류 에이티즈 우영 40
update yt_channel_videos set content_flag='보류', flag_source='manual' where id in ('M_cCKetdvSc','BdXLYu4uz1U','853fZgIrjLk','T-1BRqsPeL4','2NbmzOmFhCc','5DA4AiVOK4g','dQ_CVlIG60M','6zgdcHTo-lI','WgrBuK2UwRc','Dkx-iwPN4RU','I1QrqOSQfak','iVu6WqpZDUk','jaHHDsk2OKE','jRCh4cjm0fs','jscEr4vaYo4','O6sXSM5m45w','nA3z1EPNZXc','3smqUtu77N0','N1FODQvN83U','Ow4k2ikzpfU','0tFK_Rkm9Pg','SBXRhpupQbs','sc4iaR2B30I','sdsDzgvm_F8','TV30MhKsNNw','TX4QB3XWuuA','U2FihfG0ws8','KzgXdy0XF6c','vhJBrm_m0Dw','VOT7vm6jFz0','XBJtM6NFoQw','A9IF5SyvbkY','Rsaek2WNJpI','Zn_9pSVtbng','wS5-2E24-R8','I5vQ3ew2el4','vjPZB_vXggU','jFgmUJ99BsI','4T2wJbhBGrc','uzSIlYlHT4k') and group_ko='에이티즈' and content_flag is null and tags_manual is not true;

-- 보류 투어스 지훈 18
update yt_channel_videos set content_flag='보류', flag_source='manual' where id in ('3k_UCKd69l4','ZLApYs6rwhI','ZAdDNyZysP4','E8ravsAF6EY','hBlaM7Wvt-c','jO_0VeLkT_M','jsv6tRXu5DU','Kyy8u8vvA1M','qb7K2_hxLw4','bdrSB8ZjTao','wcxfrCPkVtA','riuHSyglU0g','y-4Y9X_9FSY','S8inm6TScTg','ZFBUixIzRxQ','A7Be-usAIkw','3E4Hih4iNK8','GqGCVGEmyC4') and group_ko='투어스' and content_flag is null and tags_manual is not true;

-- 이동 빌리 수현 → 악뮤 [이수현] 12
update yt_channel_videos set group_ko='악뮤', members=array['이수현'], with_groups='{}', with_members='{}' where id in ('0X9FdQb3ryk','tDD-xeGrUhg','lZYhZ7LCKyM','2g6ddttJzOM','4PLc2VDdg-o','5C8yqWvv4UE','fgxqtFvVFWQ','KG4Wu1XAH54','Qj7OBxT7JYg','xq0fJnzqYjU','YFuohtfZ2-I','IlGLxCRGTO8') and group_ko='빌리' and content_flag is null and tags_manual is not true;

-- 이동 에이티즈 우영 → 2PM [우영] 22
update yt_channel_videos set group_ko='2PM', members=array['우영'], with_groups='{}', with_members='{}' where id in ('VS1oi3Ol6iQ','hVc1CSExvYc','UtS7KHEY6Ig','gjx6vMhJtBY','VlRCcY3Plh0','C6dRiYAzx4U','fXkE7Tn1gbc','82p0baK8E3E','08lw99PknZI','ESCQJfYq19E','Mkq5vmnEqx4','cL2kGhcPTiE','HwNMM5RSHCw','saev7_5Oe1A','W-yGNRQrG6M','UrUYEnHW2yY','JpcTCtwzkgo','ZGiV9EPZW8Q','ZkghMrMtrmM','Zr4aroMe2cg','SANkDQhHdFI','kcf11cdMojQ') and group_ko='에이티즈' and content_flag is null and tags_manual is not true;

-- 무관 넥스지 하루 2
update yt_channel_videos set content_flag='무관', flag_source='manual' where id in ('BKGx8_PMQuY','6PfU_ytxbPw') and group_ko='넥스지' and content_flag is null and tags_manual is not true;

-- 무관 비원에이포 바로 2
update yt_channel_videos set content_flag='무관', flag_source='manual' where id in ('8Q5zTEdYJaI','tw2oePIJKtg') and group_ko='비원에이포' and content_flag is null and tags_manual is not true;

-- 무관 빌리 수현 6
update yt_channel_videos set content_flag='무관', flag_source='manual' where id in ('5OKvowhA-VE','bARN5U6MRL4','qAOazsoDq7o','CxI0QO2gkWw','wBRipF5X5Vg','Xh3Nv9YH0tU') and group_ko='빌리' and content_flag is null and tags_manual is not true;

-- 무관 아일릿 민주 1
update yt_channel_videos set content_flag='무관', flag_source='manual' where id in ('lF5UyG35qoU') and group_ko='아일릿' and content_flag is null and tags_manual is not true;

-- 멤버 교정 샤이니 키→태민 4
update yt_channel_videos set members=array['태민'] where id in ('LnLbc13WeAA','3jjfWk_e4qo','Q8bkNV7RebE','ClM4RT8Cr-Y') and group_ko='샤이니' and content_flag is null and tags_manual is not true;

select case when y.group_ko<>b.group_ko then '이동' when y.content_flag is not null then y.content_flag||'/'||coalesce(y.flag_source,'-') when y.members<>b.members then '멤버교정' else '그대로' end k, count(*) n from yt_channel_videos y join bak_20261116_rest2 b using(id) group by 1 order by 2 desc;
