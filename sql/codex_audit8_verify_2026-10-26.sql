-- 읽기 전용。正常: target_count=3,not_correct=0,backed_up=3。
WITH plan AS (SELECT * FROM jsonb_to_recordset('[
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
]'::jsonb) AS t(id text,reason text,before_state jsonb,after_state jsonb)), checked AS (
 SELECT p.*, (SELECT jsonb_object_agg(k,to_jsonb(v)->k) FROM jsonb_object_keys(p.after_state) AS q(k)) AS actual
 FROM plan p LEFT JOIN public.yt_channel_videos v ON v.id=p.id
)
SELECT count(*) AS target_count,count(*) FILTER(WHERE actual IS DISTINCT FROM after_state) AS not_correct,
 (SELECT count(*) FROM public.admin_bulk_snapshots WHERE batch_id='codex-audit8-20261026-nexz-members-3') AS backed_up FROM checked;
