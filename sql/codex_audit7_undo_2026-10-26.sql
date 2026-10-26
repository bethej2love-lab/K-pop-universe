-- 감사7차 이 배치만 원복. 후속 변경 감지 시 전체 중단. 운영에서 자동 실행하지 말 것.
-- 백업은 감사 증거로 유지. 이미 복구된 행은 건너뜀. 관리자 UI의 일반 undo 대신 이 파일 사용.
DO $undo7$
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
 p record; cur jsonb; actual jsonb; original jsonb; desired public.yt_channel_videos%ROWTYPE;
BEGIN
 PERFORM set_config('lock_timeout','5s',true);
 PERFORM set_config('statement_timeout','30s',true);
 IF (SELECT count(*) FROM public.admin_bulk_snapshots WHERE batch_id='codex-audit7-20261026-bts-origin-7')<>7 THEN RAISE EXCEPTION 'Backup scope mismatch'; END IF;
 FOR p IN SELECT * FROM jsonb_to_recordset(plan) AS t(id text,reason text,before_state jsonb,after_state jsonb) ORDER BY id LOOP
  SELECT before_data INTO original FROM public.admin_bulk_snapshots WHERE batch_id='codex-audit7-20261026-bts-origin-7' AND row_id=p.id FOR UPDATE;
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
$undo7$;
