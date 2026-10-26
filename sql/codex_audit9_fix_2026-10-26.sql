-- 감사9차: 후이/휴이 오귀속 확정10건. 운영 적용 전 원본 근거 및 현재 상태를 재확인.
-- 새 테이블·권한·매처·앱 변경 없음. 기존 관리자 전용 스냅샷에 백업.
-- 원자적 실행/사전 상태·잠금/사후 상태 검증. 재실행은 변경0. 임의로 가드를 제거하지 말 것.
DO $audit9$
DECLARE
 plan jsonb := '[
  {
    "id": "gc4mENAhkgc",
    "reason": "https://www.youtube.com/watch?v=gc4mENAhkgc 공식 원 업로더의 제목/설명이 후이(HUI)의 솔로 콘텐츠임을 명시. HYUI(넥스지 휴이)와 구분. TAGGING.md의 실존 그룹 멤버 귀속 규칙 및 artists.json 후이=펜타곤 대조. 원곡·기타 컬럼 보존.",
    "before_state": {
      "id": "gc4mENAhkgc",
      "title": "[쇼챔 원픽캠 4K] 후이(HUI) - 빙고 | Show Champion | EP.606 | 260805",
      "group_ko": "넥스지",
      "members": [
        "휴이"
      ],
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
      "id": "gc4mENAhkgc",
      "title": "[쇼챔 원픽캠 4K] 후이(HUI) - 빙고 | Show Champion | EP.606 | 260805",
      "group_ko": "펜타곤",
      "members": [
        "후이"
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
    "id": "GVWL1-wFZmA",
    "reason": "https://www.youtube.com/watch?v=GVWL1-wFZmA 공식 원 업로더의 제목/설명이 후이(HUI)의 솔로 콘텐츠임을 명시. HYUI(넥스지 휴이)와 구분. TAGGING.md의 실존 그룹 멤버 귀속 규칙 및 artists.json 후이=펜타곤 대조. 원곡·기타 컬럼 보존.",
    "before_state": {
      "id": "GVWL1-wFZmA",
      "title": "[LIVE] 후이(HUI) - 흠뻑(Hmm BOP) | dancEAR | 댄스이어 | 듣포먼스 | 라이브 퍼포먼스 | Live Performance | 4K",
      "group_ko": "넥스지",
      "members": [
        "휴이"
      ],
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
      "id": "GVWL1-wFZmA",
      "title": "[LIVE] 후이(HUI) - 흠뻑(Hmm BOP) | dancEAR | 댄스이어 | 듣포먼스 | 라이브 퍼포먼스 | Live Performance | 4K",
      "group_ko": "펜타곤",
      "members": [
        "후이"
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
    "id": "gw8Xx72BPiE",
    "reason": "https://www.youtube.com/watch?v=gw8Xx72BPiE 공식 원 업로더의 제목/설명이 후이(HUI)의 솔로 콘텐츠임을 명시. HYUI(넥스지 휴이)와 구분. TAGGING.md의 실존 그룹 멤버 귀속 규칙 및 artists.json 후이=펜타곤 대조. 원곡·기타 컬럼 보존.",
    "before_state": {
      "id": "gw8Xx72BPiE",
      "title": "[SOLO HOT DEBUT] 후이(HUI) - 흠뻑 (Hmm BOP) l Show Champion l EP.502 l 240124",
      "group_ko": "넥스지",
      "members": [
        "휴이"
      ],
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
      "id": "gw8Xx72BPiE",
      "title": "[SOLO HOT DEBUT] 후이(HUI) - 흠뻑 (Hmm BOP) l Show Champion l EP.502 l 240124",
      "group_ko": "펜타곤",
      "members": [
        "후이"
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
    "id": "KyGcMaBVnPY",
    "reason": "https://www.youtube.com/watch?v=KyGcMaBVnPY 공식 원 업로더의 제목/설명이 후이(HUI)의 솔로 콘텐츠임을 명시. HYUI(넥스지 휴이)와 구분. TAGGING.md의 실존 그룹 멤버 귀속 규칙 및 artists.json 후이=펜타곤 대조. 원곡·기타 컬럼 보존.",
    "before_state": {
      "id": "KyGcMaBVnPY",
      "title": "[4K] 후이(HUI) “흠뻑(Hmm BOP)” Band LIVE Concert 아기락스타가 보여주는 원맨고음차력쇼🤟 [it’s KPOP LIVE 잇츠라이브]",
      "group_ko": "넥스지",
      "members": [
        "휴이"
      ],
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
      "id": "KyGcMaBVnPY",
      "title": "[4K] 후이(HUI) “흠뻑(Hmm BOP)” Band LIVE Concert 아기락스타가 보여주는 원맨고음차력쇼🤟 [it’s KPOP LIVE 잇츠라이브]",
      "group_ko": "펜타곤",
      "members": [
        "후이"
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
    "id": "N6iwF1UA30w",
    "reason": "https://www.youtube.com/watch?v=N6iwF1UA30w 공식 원 업로더의 제목/설명이 후이(HUI)의 솔로 콘텐츠임을 명시. HYUI(넥스지 휴이)와 구분. TAGGING.md의 실존 그룹 멤버 귀속 규칙 및 artists.json 후이=펜타곤 대조. 원곡·기타 컬럼 보존.",
    "before_state": {
      "id": "N6iwF1UA30w",
      "title": "''솔로 데뷔 인터뷰'' with 후이 (HUI) #엠카운트다운 EP.825 | Mnet 240118 방송",
      "group_ko": "넥스지",
      "members": [
        "휴이"
      ],
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
      "id": "N6iwF1UA30w",
      "title": "''솔로 데뷔 인터뷰'' with 후이 (HUI) #엠카운트다운 EP.825 | Mnet 240118 방송",
      "group_ko": "펜타곤",
      "members": [
        "후이"
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
    "id": "OC9ELUq4rls",
    "reason": "https://www.youtube.com/watch?v=OC9ELUq4rls 공식 원 업로더의 제목/설명이 후이(HUI)의 솔로 콘텐츠임을 명시. HYUI(넥스지 휴이)와 구분. TAGGING.md의 실존 그룹 멤버 귀속 규칙 및 artists.json 후이=펜타곤 대조. 원곡·기타 컬럼 보존.",
    "before_state": {
      "id": "OC9ELUq4rls",
      "title": "[COMEBACK] 후이 (HUI) - BINGO l Show Champion l EP.606 l 260805",
      "group_ko": "넥스지",
      "members": [
        "휴이"
      ],
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
      "id": "OC9ELUq4rls",
      "title": "[COMEBACK] 후이 (HUI) - BINGO l Show Champion l EP.606 l 260805",
      "group_ko": "펜타곤",
      "members": [
        "후이"
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
    "id": "pmj2BbrzwuA",
    "reason": "https://www.youtube.com/watch?v=pmj2BbrzwuA 공식 원 업로더의 제목/설명이 후이(HUI)의 솔로 콘텐츠임을 명시. HYUI(넥스지 휴이)와 구분. TAGGING.md의 실존 그룹 멤버 귀속 규칙 및 artists.json 후이=펜타곤 대조. 원곡·기타 컬럼 보존.",
    "before_state": {
      "id": "pmj2BbrzwuA",
      "title": "[4K] 후이(HUI) “내일의 나에게(Dear Tomorrow)” Band LIVE | it''s Live",
      "group_ko": "넥스지",
      "members": [
        "휴이"
      ],
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
      "id": "pmj2BbrzwuA",
      "title": "[4K] 후이(HUI) “내일의 나에게(Dear Tomorrow)” Band LIVE | it''s Live",
      "group_ko": "펜타곤",
      "members": [
        "후이"
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
    "id": "uyNt5IRdXaw",
    "reason": "https://www.youtube.com/watch?v=uyNt5IRdXaw 공식 원 업로더의 제목/설명이 후이(HUI)의 솔로 콘텐츠임을 명시. HYUI(넥스지 휴이)와 구분. TAGGING.md의 실존 그룹 멤버 귀속 규칙 및 artists.json 후이=펜타곤 대조. 원곡·기타 컬럼 보존.",
    "before_state": {
      "id": "uyNt5IRdXaw",
      "title": "[쇼챔직캠 4K] 후이 (HUI) - 빙고 | Show Champion | EP.606 | 260805",
      "group_ko": "넥스지",
      "members": [
        "휴이"
      ],
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
      "id": "uyNt5IRdXaw",
      "title": "[쇼챔직캠 4K] 후이 (HUI) - 빙고 | Show Champion | EP.606 | 260805",
      "group_ko": "펜타곤",
      "members": [
        "후이"
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
    "id": "Y6AS0P_Jvow",
    "reason": "https://www.youtube.com/watch?v=Y6AS0P_Jvow 공식 원 업로더의 제목/설명이 후이(HUI)의 솔로 콘텐츠임을 명시. HYUI(넥스지 휴이)와 구분. TAGGING.md의 실존 그룹 멤버 귀속 규칙 및 artists.json 후이=펜타곤 대조. 원곡·기타 컬럼 보존.",
    "before_state": {
      "id": "Y6AS0P_Jvow",
      "title": "[it’s Live] 후이(HUI) - “흠뻑(Hmm BOP)” 미방분 1인캠 ver. #itsLive #후이 #흠뻑 #HUI #Hmm_BOP #KPOP #잇츠라이브",
      "group_ko": "넥스지",
      "members": [
        "휴이"
      ],
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
      "id": "Y6AS0P_Jvow",
      "title": "[it’s Live] 후이(HUI) - “흠뻑(Hmm BOP)” 미방분 1인캠 ver. #itsLive #후이 #흠뻑 #HUI #Hmm_BOP #KPOP #잇츠라이브",
      "group_ko": "펜타곤",
      "members": [
        "후이"
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
    "id": "yvIy-3c6zvE",
    "reason": "https://www.youtube.com/watch?v=yvIy-3c6zvE 공식 원 업로더의 제목/설명이 후이(HUI)의 솔로 콘텐츠임을 명시. HYUI(넥스지 휴이)와 구분. TAGGING.md의 실존 그룹 멤버 귀속 규칙 및 artists.json 후이=펜타곤 대조. 원곡·기타 컬럼 보존.",
    "before_state": {
      "id": "yvIy-3c6zvE",
      "title": "[릴레이댄스] 후이(HUI) - 흠뻑(Hmm BOP) (4K)",
      "group_ko": "넥스지",
      "members": [
        "휴이"
      ],
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
      "id": "yvIy-3c6zvE",
      "title": "[릴레이댄스] 후이(HUI) - 흠뻑(Hmm BOP) (4K)",
      "group_ko": "펜타곤",
      "members": [
        "후이"
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
 IF jsonb_array_length(plan)<>10 THEN RAISE EXCEPTION 'Unexpected audit scope'; END IF;
 FOR p IN SELECT * FROM jsonb_to_recordset(plan) AS t(id text,reason text,before_state jsonb,after_state jsonb) ORDER BY id LOOP
  SELECT to_jsonb(v) INTO cur FROM public.yt_channel_videos v WHERE v.id=p.id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Missing video: %',p.id; END IF;
  SELECT jsonb_object_agg(k,cur->k) INTO actual FROM jsonb_object_keys(p.before_state) AS q(k);
  IF actual = p.after_state THEN CONTINUE; END IF;
  IF actual IS DISTINCT FROM p.before_state THEN RAISE EXCEPTION 'Audited state changed: %',p.id; END IF;
  IF EXISTS(SELECT 1 FROM public.admin_bulk_snapshots WHERE batch_id='codex-audit9-20261026-hui-identity-10' AND row_id=p.id) THEN
   RAISE EXCEPTION 'Existing backup; review before reapply: %',p.id;
  END IF;
 END LOOP;
 FOR p IN SELECT * FROM jsonb_to_recordset(plan) AS t(id text,reason text,before_state jsonb,after_state jsonb) ORDER BY id LOOP
  SELECT to_jsonb(v) INTO cur FROM public.yt_channel_videos v WHERE v.id=p.id;
  SELECT jsonb_object_agg(k,cur->k) INTO actual FROM jsonb_object_keys(p.before_state) AS q(k);
  IF actual = p.after_state THEN CONTINUE; END IF;
  unchanged := cur - ARRAY['group_ko','members','with_members','with_groups','cover_of_groups','cover_of_members','cover_of_song','tags_manual','cover_manual','updated_at'];
  INSERT INTO public.admin_bulk_snapshots(batch_id,op_label,row_id,before_data)
   VALUES('codex-audit9-20261026-hui-identity-10','Codex 감사9차 후이/휴이 식별10건 (전용 undo SQL 사용)',p.id,actual);
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
 RAISE NOTICE 'Audit9 changed % rows',changed;
END
$audit9$;
