-- 감사7차: 원곡/출연자 역전 확정7건. 운영 적용 전 원본 근거 및 현재 상태를 재확인.
-- 새 테이블·권한·매처·앱 변경 없음. 기존 관리자 전용 스냅샷에 백업.
-- 원자적 실행/사전 상태·잠금/사후 상태 검증. 재실행은 변경0. 임의로 가드를 제거하지 말 것.
DO $audit7$
DECLARE
 plan jsonb := '[
  {
    "id": "0TwOk9EeJSY",
    "reason": "1theK Originals 공식 제목·설명은 드림노트 보니 개인 직캠. 보니는 원곡자가 아니라 출연자.",
    "before_state": {
      "id": "0TwOk9EeJSY",
      "title": "드림노트 보니 ''상남자'' 직캠 | DreamNote BoNi | BTS(방탄소년단) _ Boy In Luv | 춤추는 신인(Dancing Rookie) | Dance Cover",
      "group_ko": "방탄소년단",
      "members": [],
      "with_members": [],
      "with_groups": [],
      "cover_of_groups": [],
      "cover_of_members": [
        "보니(드림노트)"
      ],
      "cover_of_song": "상남자",
      "tags_manual": false,
      "cover_manual": false,
      "content_flag": null,
      "flag_source": null,
      "flagged_at": null
    },
    "after_state": {
      "id": "0TwOk9EeJSY",
      "title": "드림노트 보니 ''상남자'' 직캠 | DreamNote BoNi | BTS(방탄소년단) _ Boy In Luv | 춤추는 신인(Dancing Rookie) | Dance Cover",
      "group_ko": "드림노트",
      "members": [
        "보니"
      ],
      "with_members": [],
      "with_groups": [],
      "cover_of_groups": [
        "방탄소년단"
      ],
      "cover_of_members": [],
      "cover_of_song": "상남자",
      "tags_manual": true,
      "cover_manual": true,
      "content_flag": null,
      "flag_source": null,
      "flagged_at": null
    }
  },
  {
    "id": "47ci_on2iLY",
    "reason": "ALL THE K-POP 공식 제목·설명은 체리블렛의 BTS MIC Drop 커버.",
    "before_state": {
      "id": "47ci_on2iLY",
      "title": "[방송선공개] 체리블렛의 방탄소년단 ＜MIC Drop＞  2배속 커버 무대♬",
      "group_ko": "방탄소년단",
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
      "id": "47ci_on2iLY",
      "title": "[방송선공개] 체리블렛의 방탄소년단 ＜MIC Drop＞  2배속 커버 무대♬",
      "group_ko": "체리블렛",
      "members": [],
      "with_members": [],
      "with_groups": [],
      "cover_of_groups": [
        "방탄소년단"
      ],
      "cover_of_members": [],
      "cover_of_song": "MIC Drop",
      "tags_manual": true,
      "cover_manual": true,
      "content_flag": null,
      "flag_source": null,
      "flagged_at": null
    }
  },
  {
    "id": "6BibMYh3vhs",
    "reason": "Mnet 공식 풀버전 제목·설명은 베리베리와 TOO의 ON 합동무대. 원곡 BTS.",
    "before_state": {
      "id": "6BibMYh3vhs",
      "title": "Road to Kingdom [풀버전] ♬ ON - 베리베리XTOO (원곡: 방탄소년단) @3차 경연 컬래버레이션 무대 200528 EP.5",
      "group_ko": "방탄소년단",
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
      "id": "6BibMYh3vhs",
      "title": "Road to Kingdom [풀버전] ♬ ON - 베리베리XTOO (원곡: 방탄소년단) @3차 경연 컬래버레이션 무대 200528 EP.5",
      "group_ko": "베리베리",
      "members": [],
      "with_members": [],
      "with_groups": [
        "티오원"
      ],
      "cover_of_groups": [
        "방탄소년단"
      ],
      "cover_of_members": [],
      "cover_of_song": "ON",
      "tags_manual": true,
      "cover_manual": true,
      "content_flag": null,
      "flag_source": null,
      "flagged_at": null
    }
  },
  {
    "id": "BUzlgKS7a8o",
    "reason": "Mnet 공식 제목·설명은 베리베리와 TOO의 ON 합동무대. TOO는 groups.json의 티오원 옛 이름.",
    "before_state": {
      "id": "BUzlgKS7a8o",
      "title": "[ENG] Road to Kingdom [5회] ♬ ON - 베리베리XTOO (원곡: 방탄소년단) @3차 경연 컬래버레이션 무대 200528 EP.5",
      "group_ko": "방탄소년단",
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
      "id": "BUzlgKS7a8o",
      "title": "[ENG] Road to Kingdom [5회] ♬ ON - 베리베리XTOO (원곡: 방탄소년단) @3차 경연 컬래버레이션 무대 200528 EP.5",
      "group_ko": "베리베리",
      "members": [],
      "with_members": [],
      "with_groups": [
        "티오원"
      ],
      "cover_of_groups": [
        "방탄소년단"
      ],
      "cover_of_members": [],
      "cover_of_song": "ON",
      "tags_manual": true,
      "cover_manual": true,
      "content_flag": null,
      "flag_source": null,
      "flagged_at": null
    }
  },
  {
    "id": "l_B_8UC60zI",
    "reason": "ONEUS 공식 채널의 서호 Epiphany 커버. 원곡 BTS 진. 제목·설명 #ONEUS #SEOHO 확인.",
    "before_state": {
      "id": "l_B_8UC60zI",
      "title": "[US RECORD] BTS(방탄소년단) - Epiphany (Cover by 서호)",
      "group_ko": "방탄소년단",
      "members": [],
      "with_members": [],
      "with_groups": [],
      "cover_of_groups": [
        "방탄소년단"
      ],
      "cover_of_members": [],
      "cover_of_song": null,
      "tags_manual": false,
      "cover_manual": false,
      "content_flag": null,
      "flag_source": null,
      "flagged_at": null
    },
    "after_state": {
      "id": "l_B_8UC60zI",
      "title": "[US RECORD] BTS(방탄소년단) - Epiphany (Cover by 서호)",
      "group_ko": "원어스",
      "members": [
        "서호"
      ],
      "with_members": [],
      "with_groups": [],
      "cover_of_groups": [
        "방탄소년단"
      ],
      "cover_of_members": [
        "진(방탄소년단)"
      ],
      "cover_of_song": "Epiphany",
      "tags_manual": true,
      "cover_manual": true,
      "content_flag": null,
      "flag_source": null,
      "flagged_at": null
    }
  },
  {
    "id": "LcWL5qpllyg",
    "reason": "1theK Originals 공식 설명의 6곡 타임라인은 모두 BTS 곡. Shout Out Dance는 코너명이며 엔하이픈 SHOUT OUT 원곡 아님. 단일 곡명은 null.",
    "before_state": {
      "id": "LcWL5qpllyg",
      "title": "BTS를 Shout Out Dance한 기강 잡힌 미래소년 | MIRAE | 방탄소년단 | 피땀눈물 IDOL DNA Dynamite | Dance Cover | 샤라웃 댄스",
      "group_ko": "방탄소년단",
      "members": [],
      "with_members": [],
      "with_groups": [],
      "cover_of_groups": [
        "미래소년",
        "엔하이픈"
      ],
      "cover_of_members": [],
      "cover_of_song": "SHOUT OUT",
      "tags_manual": false,
      "cover_manual": false,
      "content_flag": null,
      "flag_source": null,
      "flagged_at": null
    },
    "after_state": {
      "id": "LcWL5qpllyg",
      "title": "BTS를 Shout Out Dance한 기강 잡힌 미래소년 | MIRAE | 방탄소년단 | 피땀눈물 IDOL DNA Dynamite | Dance Cover | 샤라웃 댄스",
      "group_ko": "미래소년",
      "members": [],
      "with_members": [],
      "with_groups": [],
      "cover_of_groups": [
        "방탄소년단"
      ],
      "cover_of_members": [],
      "cover_of_song": null,
      "tags_manual": true,
      "cover_manual": true,
      "content_flag": null,
      "flag_source": null,
      "flagged_at": null
    }
  },
  {
    "id": "zzo7P967fd4",
    "reason": "ALL THE K-POP 공식 설명이 짱하이픈을 엔하이픈으로 명시. BTS Dynamite 커버.",
    "before_state": {
      "id": "zzo7P967fd4",
      "title": "[방송선공개] 짱하이픈의 방탄소년단 ＜Dynamite＞ 2배속 커버 무대♬",
      "group_ko": "방탄소년단",
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
      "id": "zzo7P967fd4",
      "title": "[방송선공개] 짱하이픈의 방탄소년단 ＜Dynamite＞ 2배속 커버 무대♬",
      "group_ko": "엔하이픈",
      "members": [],
      "with_members": [],
      "with_groups": [],
      "cover_of_groups": [
        "방탄소년단"
      ],
      "cover_of_members": [],
      "cover_of_song": "Dynamite",
      "tags_manual": true,
      "cover_manual": true,
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
 IF jsonb_array_length(plan)<>7 THEN RAISE EXCEPTION 'Unexpected audit scope'; END IF;
 FOR p IN SELECT * FROM jsonb_to_recordset(plan) AS t(id text,reason text,before_state jsonb,after_state jsonb) ORDER BY id LOOP
  SELECT to_jsonb(v) INTO cur FROM public.yt_channel_videos v WHERE v.id=p.id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Missing video: %',p.id; END IF;
  SELECT jsonb_object_agg(k,cur->k) INTO actual FROM jsonb_object_keys(p.before_state) AS q(k);
  IF actual = p.after_state THEN CONTINUE; END IF;
  IF actual IS DISTINCT FROM p.before_state THEN RAISE EXCEPTION 'Audited state changed: %',p.id; END IF;
  IF EXISTS(SELECT 1 FROM public.admin_bulk_snapshots WHERE batch_id='codex-audit7-20261026-bts-origin-7' AND row_id=p.id) THEN
   RAISE EXCEPTION 'Existing backup; review before reapply: %',p.id;
  END IF;
 END LOOP;
 FOR p IN SELECT * FROM jsonb_to_recordset(plan) AS t(id text,reason text,before_state jsonb,after_state jsonb) ORDER BY id LOOP
  SELECT to_jsonb(v) INTO cur FROM public.yt_channel_videos v WHERE v.id=p.id;
  SELECT jsonb_object_agg(k,cur->k) INTO actual FROM jsonb_object_keys(p.before_state) AS q(k);
  IF actual = p.after_state THEN CONTINUE; END IF;
  unchanged := cur - ARRAY['group_ko','members','with_members','with_groups','cover_of_groups','cover_of_members','cover_of_song','tags_manual','cover_manual','updated_at'];
  INSERT INTO public.admin_bulk_snapshots(batch_id,op_label,row_id,before_data)
   VALUES('codex-audit7-20261026-bts-origin-7','Codex 감사7차 BTS 원곡/출연자7건 (전용 undo SQL 사용)',p.id,actual);
  SELECT * INTO desired FROM jsonb_populate_record(NULL::public.yt_channel_videos,p.after_state);
  UPDATE public.yt_channel_videos SET group_ko=desired.group_ko,members=desired.members,
   with_members=desired.with_members,with_groups=desired.with_groups,
   cover_of_groups=desired.cover_of_groups,cover_of_members=desired.cover_of_members,
   cover_of_song=desired.cover_of_song,tags_manual=true,cover_manual=true
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
 RAISE NOTICE 'Audit7 changed % rows',changed;
END
$audit7$;
