-- 감사21차: 시상식/게스트 오귀속 확정8건. 운영 적용 전 원본 근거 및 현재 상태를 재확인.
-- 이 SQL은 새 테이블·권한을 만들지 않음. 기존 관리자 전용 스냅샷에 백업. 매처 보완은 별도 파일.
-- 원자적 실행/사전 상태·잠금/사후 상태 검증. 재실행은 변경0. 임의로 가드를 제거하지 말 것.
DO $audit21$
DECLARE
 plan jsonb := '[
  {
    "id": "_RmmjImc6Eo",
    "reason": "https://www.youtube.com/watch?v=_RmmjImc6Eo 공식 원본 제목/업로더/설명을 재대조. 실제 DXTEEN 쇼타로 협업이며 라이즈 쇼타로 게스트만 제거; 원래 주인과 다른 출연자/원곡/공개 상태 보존.",
    "before_state": {
      "id": "_RmmjImc6Eo",
      "title": "DXTEEN 쇼타로 님과 Look So Good! @DXTEEN",
      "group_ko": "뉴비트",
      "members": [],
      "with_members": [
        "쇼타로(라이즈)"
      ],
      "with_groups": [],
      "cover_of_groups": [],
      "cover_of_members": [],
      "cover_of_song": null,
      "tags_manual": false,
      "cover_manual": false,
      "content_flag": null,
      "flag_source": null,
      "flagged_at": null
    },
    "after_state": {
      "id": "_RmmjImc6Eo",
      "title": "DXTEEN 쇼타로 님과 Look So Good! @DXTEEN",
      "group_ko": "뉴비트",
      "members": [],
      "with_members": [],
      "with_groups": [],
      "cover_of_groups": [],
      "cover_of_members": [],
      "cover_of_song": null,
      "tags_manual": true,
      "cover_manual": false,
      "content_flag": null,
      "flag_source": null,
      "flagged_at": null
    }
  },
  {
    "id": "9bi3P6OTgPI",
    "reason": "https://www.youtube.com/watch?v=9bi3P6OTgPI 공식 원본 제목/업로더/설명을 재대조. AAA 시상식 LINE-UP 본인 영상. #AAA를 트리플에스 유닛으로 오인한 저장값을 실제 출연자 소속으로 정정. 원곡/공개 상태 보존.",
    "before_state": {
      "id": "9bi3P6OTgPI",
      "title": "[AAA 2024 LINE-UP] SUHO 수호 | The 9th Asia Artist Awards IN BANGKOK #AAA #AAA2024",
      "group_ko": "트리플에스",
      "members": [
        "정혜린",
        "김유연",
        "김나경",
        "공유빈"
      ],
      "with_members": [],
      "with_groups": [],
      "cover_of_groups": [],
      "cover_of_members": [],
      "cover_of_song": null,
      "tags_manual": false,
      "cover_manual": false,
      "content_flag": null,
      "flag_source": null,
      "flagged_at": null
    },
    "after_state": {
      "id": "9bi3P6OTgPI",
      "title": "[AAA 2024 LINE-UP] SUHO 수호 | The 9th Asia Artist Awards IN BANGKOK #AAA #AAA2024",
      "group_ko": "엑소",
      "members": [
        "수호"
      ],
      "with_members": [],
      "with_groups": [],
      "cover_of_groups": [],
      "cover_of_members": [],
      "cover_of_song": null,
      "tags_manual": true,
      "cover_manual": false,
      "content_flag": null,
      "flag_source": null,
      "flagged_at": null
    }
  },
  {
    "id": "AGlvND9IwtI",
    "reason": "https://www.youtube.com/watch?v=AGlvND9IwtI 공식 원본 제목/업로더/설명을 재대조. 실제 DXTEEN 쇼타로 협업이며 라이즈 쇼타로 게스트만 제거; 원래 주인과 다른 출연자/원곡/공개 상태 보존.",
    "before_state": {
      "id": "AGlvND9IwtI",
      "title": "LOOK AT #DXTEEN NOW! 👀✨ #SHOTARO #AYUTA #nSSign #LOOK_AT_ME_NOW",
      "group_ko": "엔싸인",
      "members": [],
      "with_members": [
        "쇼타로(라이즈)"
      ],
      "with_groups": [],
      "cover_of_groups": [],
      "cover_of_members": [],
      "cover_of_song": null,
      "tags_manual": false,
      "cover_manual": false,
      "content_flag": null,
      "flag_source": null,
      "flagged_at": null
    },
    "after_state": {
      "id": "AGlvND9IwtI",
      "title": "LOOK AT #DXTEEN NOW! 👀✨ #SHOTARO #AYUTA #nSSign #LOOK_AT_ME_NOW",
      "group_ko": "엔싸인",
      "members": [],
      "with_members": [],
      "with_groups": [],
      "cover_of_groups": [],
      "cover_of_members": [],
      "cover_of_song": null,
      "tags_manual": true,
      "cover_manual": false,
      "content_flag": null,
      "flag_source": null,
      "flagged_at": null
    }
  },
  {
    "id": "g7qzgOH1jCI",
    "reason": "https://www.youtube.com/watch?v=g7qzgOH1jCI 공식 원본 제목/업로더/설명을 재대조. AAA 시상식 LINE-UP 본인 영상. #AAA를 트리플에스 유닛으로 오인한 저장값을 실제 출연자 소속으로 정정. 원곡/공개 상태 보존.",
    "before_state": {
      "id": "g7qzgOH1jCI",
      "title": "[AAA 2026 LINE-UP] ALLDAY PROJECT올데이프로젝트 | Asia Artist Awards IN KAOHSIUNG #AAA #aaa2026",
      "group_ko": "트리플에스",
      "members": [
        "정혜린",
        "김유연",
        "김나경",
        "공유빈"
      ],
      "with_members": [],
      "with_groups": [],
      "cover_of_groups": [],
      "cover_of_members": [],
      "cover_of_song": null,
      "tags_manual": false,
      "cover_manual": false,
      "content_flag": null,
      "flag_source": null,
      "flagged_at": null
    },
    "after_state": {
      "id": "g7qzgOH1jCI",
      "title": "[AAA 2026 LINE-UP] ALLDAY PROJECT올데이프로젝트 | Asia Artist Awards IN KAOHSIUNG #AAA #aaa2026",
      "group_ko": "올데이프로젝트",
      "members": [],
      "with_members": [],
      "with_groups": [],
      "cover_of_groups": [],
      "cover_of_members": [],
      "cover_of_song": null,
      "tags_manual": true,
      "cover_manual": false,
      "content_flag": null,
      "flag_source": null,
      "flagged_at": null
    }
  },
  {
    "id": "oVrEQtIoaRA",
    "reason": "https://www.youtube.com/watch?v=oVrEQtIoaRA 공식 원본 제목/업로더/설명을 재대조. 실제 DXTEEN 쇼타로 협업이며 라이즈 쇼타로 게스트만 제거; 원래 주인과 다른 출연자/원곡/공개 상태 보존.",
    "before_state": {
      "id": "oVrEQtIoaRA",
      "title": "Tick-Tack ⏰ Every moment #Pookie 💕#DXTEEN #SHOTARO 선배님과 함께한#Pookie_Challenge @DXTEEN #FIFTYFIFTY",
      "group_ko": "피프티피프티",
      "members": [],
      "with_members": [
        "쇼타로(라이즈)"
      ],
      "with_groups": [],
      "cover_of_groups": [],
      "cover_of_members": [],
      "cover_of_song": null,
      "tags_manual": false,
      "cover_manual": false,
      "content_flag": null,
      "flag_source": null,
      "flagged_at": null
    },
    "after_state": {
      "id": "oVrEQtIoaRA",
      "title": "Tick-Tack ⏰ Every moment #Pookie 💕#DXTEEN #SHOTARO 선배님과 함께한#Pookie_Challenge @DXTEEN #FIFTYFIFTY",
      "group_ko": "피프티피프티",
      "members": [],
      "with_members": [],
      "with_groups": [],
      "cover_of_groups": [],
      "cover_of_members": [],
      "cover_of_song": null,
      "tags_manual": true,
      "cover_manual": false,
      "content_flag": null,
      "flag_source": null,
      "flagged_at": null
    }
  },
  {
    "id": "pNw_QKaBiTs",
    "reason": "https://www.youtube.com/watch?v=pNw_QKaBiTs 공식 원본 제목/업로더/설명을 재대조. 실제 DXTEEN 쇼타로 협업이며 라이즈 쇼타로 게스트만 제거; 원래 주인과 다른 출연자/원곡/공개 상태 보존.",
    "before_state": {
      "id": "pNw_QKaBiTs",
      "title": "DXTEEN 쇼타로, 나루님이랑 같이 Like a waterfall🏄‍♂️ #DXTEEN #田中笑太郎 #大久保波留 #WATERFALL #WATERFALL_CHALLENGE",
      "group_ko": "유나이트",
      "members": [],
      "with_members": [
        "쇼타로(라이즈)"
      ],
      "with_groups": [],
      "cover_of_groups": [],
      "cover_of_members": [],
      "cover_of_song": null,
      "tags_manual": false,
      "cover_manual": false,
      "content_flag": null,
      "flag_source": null,
      "flagged_at": null
    },
    "after_state": {
      "id": "pNw_QKaBiTs",
      "title": "DXTEEN 쇼타로, 나루님이랑 같이 Like a waterfall🏄‍♂️ #DXTEEN #田中笑太郎 #大久保波留 #WATERFALL #WATERFALL_CHALLENGE",
      "group_ko": "유나이트",
      "members": [],
      "with_members": [],
      "with_groups": [],
      "cover_of_groups": [],
      "cover_of_members": [],
      "cover_of_song": null,
      "tags_manual": true,
      "cover_manual": false,
      "content_flag": null,
      "flag_source": null,
      "flagged_at": null
    }
  },
  {
    "id": "Uh0E5fj4xtk",
    "reason": "https://www.youtube.com/watch?v=Uh0E5fj4xtk 공식 원본 제목/업로더/설명을 재대조. AAA 시상식 LINE-UP 본인 영상. #AAA를 트리플에스 유닛으로 오인한 저장값을 실제 출연자 소속으로 정정. 원곡/공개 상태 보존.",
    "before_state": {
      "id": "Uh0E5fj4xtk",
      "title": "[AAA 2026 LINE-UP] TZUYU 쯔위 | Asia Artist Awards IN KAOHSIUNG #AAA #aaa2026 (Mandarin ver.)",
      "group_ko": "트리플에스",
      "members": [
        "정혜린",
        "김유연",
        "김나경",
        "공유빈"
      ],
      "with_members": [],
      "with_groups": [],
      "cover_of_groups": [],
      "cover_of_members": [],
      "cover_of_song": null,
      "tags_manual": false,
      "cover_manual": false,
      "content_flag": null,
      "flag_source": null,
      "flagged_at": null
    },
    "after_state": {
      "id": "Uh0E5fj4xtk",
      "title": "[AAA 2026 LINE-UP] TZUYU 쯔위 | Asia Artist Awards IN KAOHSIUNG #AAA #aaa2026 (Mandarin ver.)",
      "group_ko": "트와이스",
      "members": [
        "쯔위"
      ],
      "with_members": [],
      "with_groups": [],
      "cover_of_groups": [],
      "cover_of_members": [],
      "cover_of_song": null,
      "tags_manual": true,
      "cover_manual": false,
      "content_flag": null,
      "flag_source": null,
      "flagged_at": null
    }
  },
  {
    "id": "YHPYLWDqUXw",
    "reason": "https://www.youtube.com/watch?v=YHPYLWDqUXw 공식 원본 제목/업로더/설명을 재대조. 실제 DXTEEN 쇼타로 협업이며 라이즈 쇼타로 게스트만 제거; 원래 주인과 다른 출연자/원곡/공개 상태 보존.",
    "before_state": {
      "id": "YHPYLWDqUXw",
      "title": "#DXTEEN #쇼타로 #타이치 #켄 님과 함께 가슴 속 두근대는 #슈퍼파워챌린지 😘 #루네이트 #LUN8 #타쿠마 #지은호 #디엑스틴 #SHOTARO #TAICHI #KEN",
      "group_ko": "루네이트",
      "members": [
        "타쿠마",
        "지은호"
      ],
      "with_members": [
        "쇼타로(라이즈)"
      ],
      "with_groups": [],
      "cover_of_groups": [],
      "cover_of_members": [],
      "cover_of_song": null,
      "tags_manual": false,
      "cover_manual": false,
      "content_flag": null,
      "flag_source": null,
      "flagged_at": null
    },
    "after_state": {
      "id": "YHPYLWDqUXw",
      "title": "#DXTEEN #쇼타로 #타이치 #켄 님과 함께 가슴 속 두근대는 #슈퍼파워챌린지 😘 #루네이트 #LUN8 #타쿠마 #지은호 #디엑스틴 #SHOTARO #TAICHI #KEN",
      "group_ko": "루네이트",
      "members": [
        "타쿠마",
        "지은호"
      ],
      "with_members": [],
      "with_groups": [],
      "cover_of_groups": [],
      "cover_of_members": [],
      "cover_of_song": null,
      "tags_manual": true,
      "cover_manual": false,
      "content_flag": null,
      "flag_source": null,
      "flagged_at": null
    }
  }
]'::jsonb;
 p record; cur jsonb; actual jsonb; unchanged jsonb;
 desired public.yt_channel_videos%ROWTYPE;
 changed integer := 0;
BEGIN
 PERFORM set_config('lock_timeout','5s',true);
 PERFORM set_config('statement_timeout','30s',true);
 IF jsonb_array_length(plan)<>8 THEN RAISE EXCEPTION 'Unexpected audit scope'; END IF;
 FOR p IN SELECT * FROM jsonb_to_recordset(plan) AS t(id text,reason text,before_state jsonb,after_state jsonb) ORDER BY id LOOP
  SELECT to_jsonb(v) INTO cur FROM public.yt_channel_videos v WHERE v.id=p.id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Missing video: %',p.id; END IF;
  SELECT jsonb_object_agg(k,cur->k) INTO actual FROM jsonb_object_keys(p.before_state) AS q(k);
  IF actual = p.after_state THEN CONTINUE; END IF;
  IF actual IS DISTINCT FROM p.before_state THEN RAISE EXCEPTION 'Audited state changed: %',p.id; END IF;
  IF EXISTS(SELECT 1 FROM public.admin_bulk_snapshots WHERE batch_id='codex-audit21-20261029-identity-8' AND row_id=p.id) THEN
   RAISE EXCEPTION 'Existing backup; review before reapply: %',p.id;
  END IF;
 END LOOP;
 FOR p IN SELECT * FROM jsonb_to_recordset(plan) AS t(id text,reason text,before_state jsonb,after_state jsonb) ORDER BY id LOOP
  SELECT to_jsonb(v) INTO cur FROM public.yt_channel_videos v WHERE v.id=p.id;
  SELECT jsonb_object_agg(k,cur->k) INTO actual FROM jsonb_object_keys(p.before_state) AS q(k);
  IF actual = p.after_state THEN CONTINUE; END IF;
  unchanged := cur - ARRAY['group_ko','members','with_members','with_groups','cover_of_groups','cover_of_members','cover_of_song','tags_manual','cover_manual','updated_at'];
  INSERT INTO public.admin_bulk_snapshots(batch_id,op_label,row_id,before_data)
   VALUES('codex-audit21-20261029-identity-8','Codex 감사21차 시상식/외부 동명이인8건 (전용 undo SQL 사용)',p.id,actual);
  SELECT * INTO desired FROM jsonb_populate_record(NULL::public.yt_channel_videos,p.after_state);
  UPDATE public.yt_channel_videos SET group_ko=desired.group_ko,members=desired.members,
   with_members=desired.with_members,with_groups=desired.with_groups,
   cover_of_groups=desired.cover_of_groups,cover_of_members=desired.cover_of_members,
   cover_of_song=desired.cover_of_song,tags_manual=true,cover_manual=desired.cover_manual
   WHERE id=p.id AND tags_manual=false AND cover_manual=false;
  IF NOT FOUND THEN RAISE EXCEPTION 'Manual lock changed: %',p.id; END IF;
  SELECT to_jsonb(v) INTO cur FROM public.yt_channel_videos v WHERE v.id=p.id;
  SELECT jsonb_object_agg(k,cur->k) INTO actual FROM jsonb_object_keys(p.after_state) AS q(k);
  IF actual IS DISTINCT FROM p.after_state THEN RAISE EXCEPTION 'Post-check failed: %',p.id; END IF;
  IF (cur - ARRAY['group_ko','members','with_members','with_groups','cover_of_groups','cover_of_members','cover_of_song','tags_manual','cover_manual','updated_at']) IS DISTINCT FROM unchanged THEN
   RAISE EXCEPTION 'Unrelated column changed: %',p.id;
  END IF;
  changed:=changed+1;
 END LOOP;
 RAISE NOTICE 'Audit21 changed % rows',changed;
END
$audit21$;
