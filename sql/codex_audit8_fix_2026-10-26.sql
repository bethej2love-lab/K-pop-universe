-- 감사8차: 개인커버 멤버 누락 확정3건. 운영 적용 전 원본 근거 및 현재 상태를 재확인.
-- 새 테이블·권한·매처·앱 변경 없음. 기존 관리자 전용 스냅샷에 백업.
-- 원자적 실행/사전 상태·잠금/사후 상태 검증. 재실행은 변경0. 임의로 가드를 제거하지 말 것.
DO $audit8$
DECLARE
 plan jsonb := '[
  {
    "id": "ej4VlE2AioM",
    "reason": "https://www.youtube.com/watch?v=ej4VlE2AioM NEXZ 공식 제목 Covered by NEXZ YU. JYP https://nexz.jype.com/profile 의 YU=유우 대조. 원곡 메타데이터는 이번 변경 범위 아님.",
    "before_state": {
      "id": "ej4VlE2AioM",
      "title": "yours (데이먼스 이어) Covered by NEXZ YU | #YU",
      "group_ko": "넥스지",
      "members": [],
      "with_groups": [],
      "with_members": [],
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
      "id": "ej4VlE2AioM",
      "title": "yours (데이먼스 이어) Covered by NEXZ YU | #YU",
      "group_ko": "넥스지",
      "members": [
        "유우"
      ],
      "with_groups": [],
      "with_members": [],
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
    "id": "IegsJ5mWaww",
    "reason": "https://www.youtube.com/watch?v=IegsJ5mWaww NEXZ 공식 제목 Covered by NEXZ HYUI. JYP https://nexz.jype.com/profile 의 HYUI=휴이 대조. 원곡 메타데이터 보존.",
    "before_state": {
      "id": "IegsJ5mWaww",
      "title": "Flower (Johnny Stimson) Covered by NEXZ HYUI | #HYUI",
      "group_ko": "넥스지",
      "members": [],
      "with_groups": [],
      "with_members": [],
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
      "id": "IegsJ5mWaww",
      "title": "Flower (Johnny Stimson) Covered by NEXZ HYUI | #HYUI",
      "group_ko": "넥스지",
      "members": [
        "휴이"
      ],
      "with_groups": [],
      "with_members": [],
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
    "id": "jLy2xHJ8OiU",
    "reason": "https://www.youtube.com/watch?v=jLy2xHJ8OiU NEXZ 공식 제목 Covered by NEXZ SO GEON. JYP https://nexz.jype.com/profile 의 SO GEON=소 건 대조; 로컬 표준명 소건. 원곡 메타데이터 보존.",
    "before_state": {
      "id": "jLy2xHJ8OiU",
      "title": "좋아해.. (죠지) Covered by NEXZ SO GEON | #SOGEON",
      "group_ko": "넥스지",
      "members": [],
      "with_groups": [],
      "with_members": [],
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
      "id": "jLy2xHJ8OiU",
      "title": "좋아해.. (죠지) Covered by NEXZ SO GEON | #SOGEON",
      "group_ko": "넥스지",
      "members": [
        "소건"
      ],
      "with_groups": [],
      "with_members": [],
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
 IF jsonb_array_length(plan)<>3 THEN RAISE EXCEPTION 'Unexpected audit scope'; END IF;
 FOR p IN SELECT * FROM jsonb_to_recordset(plan) AS t(id text,reason text,before_state jsonb,after_state jsonb) ORDER BY id LOOP
  SELECT to_jsonb(v) INTO cur FROM public.yt_channel_videos v WHERE v.id=p.id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Missing video: %',p.id; END IF;
  SELECT jsonb_object_agg(k,cur->k) INTO actual FROM jsonb_object_keys(p.before_state) AS q(k);
  IF actual = p.after_state THEN CONTINUE; END IF;
  IF actual IS DISTINCT FROM p.before_state THEN RAISE EXCEPTION 'Audited state changed: %',p.id; END IF;
  IF EXISTS(SELECT 1 FROM public.admin_bulk_snapshots WHERE batch_id='codex-audit8-20261026-nexz-members-3' AND row_id=p.id) THEN
   RAISE EXCEPTION 'Existing backup; review before reapply: %',p.id;
  END IF;
 END LOOP;
 FOR p IN SELECT * FROM jsonb_to_recordset(plan) AS t(id text,reason text,before_state jsonb,after_state jsonb) ORDER BY id LOOP
  SELECT to_jsonb(v) INTO cur FROM public.yt_channel_videos v WHERE v.id=p.id;
  SELECT jsonb_object_agg(k,cur->k) INTO actual FROM jsonb_object_keys(p.before_state) AS q(k);
  IF actual = p.after_state THEN CONTINUE; END IF;
  unchanged := cur - ARRAY['group_ko','members','with_members','with_groups','cover_of_groups','cover_of_members','cover_of_song','tags_manual','cover_manual','updated_at'];
  INSERT INTO public.admin_bulk_snapshots(batch_id,op_label,row_id,before_data)
   VALUES('codex-audit8-20261026-nexz-members-3','Codex 감사8차 넥스지 개인커버 멤버3건 (전용 undo SQL 사용)',p.id,actual);
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
 RAISE NOTICE 'Audit8 changed % rows',changed;
END
$audit8$;
