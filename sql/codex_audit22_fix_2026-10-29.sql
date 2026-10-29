-- 감사22차: 개인 직캠 범위 확정6건. 운영 적용 전 원본 근거 및 현재 상태를 재확인.
-- 새 테이블·권한·매처·앱 변경 없음. 기존 관리자 전용 스냅샷에 백업.
-- 원자적 실행/사전 상태·잠금/사후 상태 검증. 재실행은 변경0. 임의로 가드를 제거하지 말 것.
DO $audit22$
DECLARE
 plan jsonb := '[
  {
    "id": "_tXLrxQa3Ic",
    "reason": "https://www.youtube.com/watch?v=_tXLrxQa3Ic 원본 제목/업로더/설명 개별 대조. ARrC CHOIHAN/최한 개인캠으로 기존 아크 한(a1809) 표준명 대조. 설명의 그룹 전원 해시태그를 출연자 전원으로 확대하지 않음.",
    "before_state": {
      "id": "_tXLrxQa3Ic",
      "title": "[플리캠 4K] ARrC CHOIHAN ''awesome'' (아크 최한 직캠) l Simply K-Pop GateWayToKorea",
      "group_ko": "아크",
      "members": [],
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
      "id": "_tXLrxQa3Ic",
      "title": "[플리캠 4K] ARrC CHOIHAN ''awesome'' (아크 최한 직캠) l Simply K-Pop GateWayToKorea",
      "group_ko": "아크",
      "members": [
        "한"
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
    "id": "Cf4LjMmCXMY",
    "reason": "https://www.youtube.com/watch?v=Cf4LjMmCXMY 원본 제목/업로더/설명 개별 대조. ARrC CHOIHAN/최한 개인캠으로 기존 아크 한(a1809) 표준명 대조. 설명의 그룹 전원 해시태그를 출연자 전원으로 확대하지 않음.",
    "before_state": {
      "id": "Cf4LjMmCXMY",
      "title": "[쇼챔직캠 4K] ARrC CHOIHAN(아크 최한) - S&S (sour and sweet) | Show Champion | EP.531 | 240904",
      "group_ko": "아크",
      "members": [],
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
      "id": "Cf4LjMmCXMY",
      "title": "[쇼챔직캠 4K] ARrC CHOIHAN(아크 최한) - S&S (sour and sweet) | Show Champion | EP.531 | 240904",
      "group_ko": "아크",
      "members": [
        "한"
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
    "id": "lHJvlPRwtfE",
    "reason": "https://www.youtube.com/watch?v=lHJvlPRwtfE 원본 제목/업로더/설명 개별 대조. 고려대학교 TV방송국 KTN 멤버직캠 제목의 촬영 대상만 지정. 설명의 이즈나 전원 해시태그와 구분. 단체 FullVer는 수정 범위 밖.",
    "before_state": {
      "id": "lHJvlPRwtfE",
      "title": "[4K 멤버직캠] 고려대 축제 이즈나(izna) \"마이\" - METRONOME  | 260929 고연전 전야제 1일차 (METRONOME)",
      "group_ko": "이즈나",
      "members": [],
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
      "id": "lHJvlPRwtfE",
      "title": "[4K 멤버직캠] 고려대 축제 이즈나(izna) \"마이\" - METRONOME  | 260929 고연전 전야제 1일차 (METRONOME)",
      "group_ko": "이즈나",
      "members": [
        "마이"
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
    "id": "Wo0t9NFc2AY",
    "reason": "https://www.youtube.com/watch?v=Wo0t9NFc2AY 원본 제목/업로더/설명 개별 대조. 고려대학교 TV방송국 KTN 멤버직캠 제목의 촬영 대상만 지정. 설명의 이즈나 전원 해시태그와 구분. 단체 FullVer는 수정 범위 밖.",
    "before_state": {
      "id": "Wo0t9NFc2AY",
      "title": "[4K 멤버직캠] 고려대 축제 이즈나(izna) \"최정은\" - Mamma Mia | 260929 고연전 전야제 1일차 (Mamma Mia)",
      "group_ko": "이즈나",
      "members": [],
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
      "id": "Wo0t9NFc2AY",
      "title": "[4K 멤버직캠] 고려대 축제 이즈나(izna) \"최정은\" - Mamma Mia | 260929 고연전 전야제 1일차 (Mamma Mia)",
      "group_ko": "이즈나",
      "members": [
        "최정은"
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
    "id": "Wo38y_yqVQg",
    "reason": "https://www.youtube.com/watch?v=Wo38y_yqVQg 원본 제목/업로더/설명 개별 대조. 고려대학교 TV방송국 KTN 멤버직캠 제목의 촬영 대상만 지정. 설명의 이즈나 전원 해시태그와 구분. 단체 FullVer는 수정 범위 밖.",
    "before_state": {
      "id": "Wo38y_yqVQg",
      "title": "[4K 멤버직캠] 고려대 축제 이즈나(izna) \"정세비\" - R.I.P | 260929 고연전 전야제 1일차 (R.I.P)",
      "group_ko": "이즈나",
      "members": [],
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
      "id": "Wo38y_yqVQg",
      "title": "[4K 멤버직캠] 고려대 축제 이즈나(izna) \"정세비\" - R.I.P | 260929 고연전 전야제 1일차 (R.I.P)",
      "group_ko": "이즈나",
      "members": [
        "정세비"
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
    "id": "zG12rrUFMvE",
    "reason": "https://www.youtube.com/watch?v=zG12rrUFMvE 원본 제목/업로더/설명 개별 대조. ARrC CHOIHAN/최한 개인캠으로 기존 아크 한(a1809) 표준명 대조. 설명의 그룹 전원 해시태그를 출연자 전원으로 확대하지 않음.",
    "before_state": {
      "id": "zG12rrUFMvE",
      "title": "ARrC (아크) 최한 (CHOIHAN) | OFF직캠 하이라이트 | 4K | Off The Stage",
      "group_ko": "아크",
      "members": [
        "현민",
        "끼엔",
        "앤디",
        "리오토",
        "도하",
        "지빈"
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
      "id": "zG12rrUFMvE",
      "title": "ARrC (아크) 최한 (CHOIHAN) | OFF직캠 하이라이트 | 4K | Off The Stage",
      "group_ko": "아크",
      "members": [
        "한"
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
 IF jsonb_array_length(plan)<>6 THEN RAISE EXCEPTION 'Unexpected audit scope'; END IF;
 FOR p IN SELECT * FROM jsonb_to_recordset(plan) AS t(id text,reason text,before_state jsonb,after_state jsonb) ORDER BY id LOOP
  SELECT to_jsonb(v) INTO cur FROM public.yt_channel_videos v WHERE v.id=p.id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Missing video: %',p.id; END IF;
  SELECT jsonb_object_agg(k,cur->k) INTO actual FROM jsonb_object_keys(p.before_state) AS q(k);
  IF actual = p.after_state THEN CONTINUE; END IF;
  IF actual IS DISTINCT FROM p.before_state THEN RAISE EXCEPTION 'Audited state changed: %',p.id; END IF;
  IF EXISTS(SELECT 1 FROM public.admin_bulk_snapshots WHERE batch_id='codex-audit22-20261029-focus-6' AND row_id=p.id) THEN
   RAISE EXCEPTION 'Existing backup; review before reapply: %',p.id;
  END IF;
 END LOOP;
 FOR p IN SELECT * FROM jsonb_to_recordset(plan) AS t(id text,reason text,before_state jsonb,after_state jsonb) ORDER BY id LOOP
  SELECT to_jsonb(v) INTO cur FROM public.yt_channel_videos v WHERE v.id=p.id;
  SELECT jsonb_object_agg(k,cur->k) INTO actual FROM jsonb_object_keys(p.before_state) AS q(k);
  IF actual = p.after_state THEN CONTINUE; END IF;
  unchanged := cur - ARRAY['group_ko','members','with_members','with_groups','cover_of_groups','cover_of_members','cover_of_song','tags_manual','cover_manual','updated_at'];
  INSERT INTO public.admin_bulk_snapshots(batch_id,op_label,row_id,before_data)
   VALUES('codex-audit22-20261029-focus-6','Codex 감사22차 개인 직캠6건 (전용 undo SQL 사용)',p.id,actual);
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
 RAISE NOTICE 'Audit22 changed % rows',changed;
END
$audit22$;
