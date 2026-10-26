-- 감사8차 이 배치만 원복. 후속 변경 감지 시 전체 중단. 운영에서 자동 실행하지 말 것.
-- 백업은 감사 증거로 유지. 이미 복구된 행은 건너뜀. 관리자 UI의 일반 undo 대신 이 파일 사용.
DO $undo8$
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
 p record; cur jsonb; actual jsonb; original jsonb; desired public.yt_channel_videos%ROWTYPE;
BEGIN
 PERFORM set_config('lock_timeout','5s',true);
 PERFORM set_config('statement_timeout','30s',true);
 IF (SELECT count(*) FROM public.admin_bulk_snapshots WHERE batch_id='codex-audit8-20261026-nexz-members-3')<>3 THEN RAISE EXCEPTION 'Backup scope mismatch'; END IF;
 FOR p IN SELECT * FROM jsonb_to_recordset(plan) AS t(id text,reason text,before_state jsonb,after_state jsonb) ORDER BY id LOOP
  SELECT before_data INTO original FROM public.admin_bulk_snapshots WHERE batch_id='codex-audit8-20261026-nexz-members-3' AND row_id=p.id FOR UPDATE;
  IF original IS DISTINCT FROM p.before_state THEN RAISE EXCEPTION 'Backup mismatch: %',p.id; END IF;
  SELECT to_jsonb(v) INTO cur FROM public.yt_channel_videos v WHERE v.id=p.id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Missing video: %',p.id; END IF;
  SELECT jsonb_object_agg(k,cur->k) INTO actual FROM jsonb_object_keys(p.before_state) AS q(k);
  IF actual = p.before_state THEN CONTINUE; END IF;
  IF actual IS DISTINCT FROM p.after_state THEN RAISE EXCEPTION 'Later edit detected: %',p.id; END IF;
 END LOOP;
 FOR p IN SELECT * FROM jsonb_to_recordset(plan) AS t(id text,reason text,before_state jsonb,after_state jsonb) ORDER BY id LOOP
  SELECT (SELECT jsonb_object_agg(k,to_jsonb(v)->k) FROM jsonb_object_keys(p.before_state) AS q(k)) INTO actual FROM public.yt_channel_videos v WHERE v.id=p.id;
  IF actual = p.before_state THEN CONTINUE; END IF;
  SELECT * INTO desired FROM jsonb_populate_record(NULL::public.yt_channel_videos,p.before_state);
  UPDATE public.yt_channel_videos SET tags_manual=false WHERE id=p.id;
  UPDATE public.yt_channel_videos SET group_ko=desired.group_ko,members=desired.members,
   with_members=desired.with_members,with_groups=desired.with_groups,
   cover_of_groups=desired.cover_of_groups,cover_of_members=desired.cover_of_members,
   cover_of_song=desired.cover_of_song,tags_manual=desired.tags_manual,cover_manual=desired.cover_manual WHERE id=p.id;
  SELECT (SELECT jsonb_object_agg(k,to_jsonb(v)->k) FROM jsonb_object_keys(p.before_state) AS q(k)) INTO actual FROM public.yt_channel_videos v WHERE v.id=p.id;
  IF actual IS DISTINCT FROM p.before_state THEN RAISE EXCEPTION 'Undo verification failed: %',p.id; END IF;
 END LOOP;
END
$undo8$;
