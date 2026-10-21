-- 서바이벌 프로그램 연습생이 부른 블랙핑크 곡("♬곡 - BLACKPINK" 크레딧)이 group_ko=블랙핑크로 붙어 노출되던 것(2026-10-21)
-- 같은 유형 59건은 이미 '보류' — 아직 노출 중이던 7건을 같은 처리로. 공연자(연습생)는 유니버스에 없어 보류가 맞다.
UPDATE yt_channel_videos SET content_flag='보류', flag_source='auto', flagged_at=now(), needs_review=true, cover_of_groups=ARRAY['블랙핑크']
WHERE group_ko='블랙핑크' AND content_flag IS NULL AND coalesce(tags_manual,false)=false
  AND id IN ('xp3nePXs3xA','SOU58LwZFx4','zFCJm-BACwg','iIziODexTYE','DZIzmpKjSZY','1_VMFx0Re3s','hTt-0VBkN0o');
-- 로드 투 킹덤 3차 경연 펜타곤X온앤오프 콜라보 'Kill This Love(원곡 : BLACKPINK)' — 주인은 펜타곤, 함께한 그룹 온앤오프, 원곡 블랙핑크
UPDATE yt_channel_videos SET group_ko='펜타곤', members='{}', with_groups=ARRAY['온앤오프'], with_members='{}', cover_of_groups=ARRAY['블랙핑크']
WHERE id='1OfcitSfFyQ' AND group_ko='블랙핑크' AND coalesce(tags_manual,false)=false;
