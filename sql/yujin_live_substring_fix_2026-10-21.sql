-- "[LIVE]"·"Live Session" 안의 IVE를 아이브로 읽어 다른 유진(전유진·신유진)이 아이브 안유진으로 붙은 것 (2026-10-21)
-- 매처 수정 후 LIVE 제목 20,288건 차분: 바뀐 건 아래 3건뿐(전부 개선). 4번째(jRTmPqix4QE)는 이미 '무관'인데 멤버만 남아 있던 것.
UPDATE yt_channel_videos SET content_flag='무관', flag_source='auto', flagged_at=now(), needs_review=true, members='{}'
WHERE group_ko='아이브' AND content_flag IS NULL AND coalesce(tags_manual,false)=false AND id IN ('sJBXBYRTULY','QbEtYGBXp6I','ZCjejBmCaB0');
UPDATE yt_channel_videos SET members='{}'
WHERE group_ko='아이브' AND coalesce(tags_manual,false)=false AND id='jRTmPqix4QE';
