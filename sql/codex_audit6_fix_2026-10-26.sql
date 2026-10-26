-- 콘텐츠 감사6차 확정26건 정정. 임시표/별도 BEGIN/COMMIT 의존 없음.
-- 관리자 역할로 파일 전체 실행. 이미 정정된 건은 변경0, 준비 후 다른 태그 변경은 전체 중단.
-- 한 DO 문 안에서 원본 백업·사전 확인·정정·사후 확인까지 원자적으로 처리.
-- 보류3건 제외, 수정 대상/태그/백업 정책은 최초 버전과 같음.
-- 운영 DB는 2026-10-26 오류 제보 뒤 GET 확인에서 이미26건 모두 목표 상태였음.
-- 확인만 필요하면 codex_audit6_verify_2026-10-26.sql 사용(정정 재실행 불필요).
-- 각 원본 https://www.youtube.com/watch?v=<ID>, 상세 근거는 reason과 CHANGELOG.
-- MC 출연 근거 https://ent.sbs.co.kr/news/article.do?article_id=E10010268189
DO $audit$
DECLARE
  plan jsonb := '[
  {
    "id": "hIHioYAlU64",
    "action": "retag",
    "reason": "KBS CoolFM 공식 설명: 미래소년(MIRAE)의 EXO 첫눈 커버",
    "before_state": {
      "id": "hIHioYAlU64",
      "title": "💫 스젵 노래방 LIVE | 미래소년의 ‘첫눈’ | 원곡 : EXO(엑소) | STATION Z | KBS 230107 방송",
      "group_ko": "엑소",
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
      "id": "hIHioYAlU64",
      "title": "💫 스젵 노래방 LIVE | 미래소년의 ‘첫눈’ | 원곡 : EXO(엑소) | STATION Z | KBS 230107 방송",
      "group_ko": "미래소년",
      "members": [],
      "with_members": [],
      "with_groups": [],
      "cover_of_groups": [
        "엑소"
      ],
      "cover_of_members": [],
      "cover_of_song": "첫눈",
      "tags_manual": true,
      "cover_manual": true,
      "content_flag": null,
      "flag_source": null,
      "flagged_at": null
    }
  },
  {
    "id": "08vzsuA6r5w",
    "action": "retag",
    "reason": "THE K-POP MC NAEggUZ 공연 + SBS 공식 2023-03-28 기사로 여상·샤오쥔·형섭 확인",
    "before_state": {
      "id": "08vzsuA6r5w",
      "title": "MC NAEggUZ, Bloomig Day (MC NAEggUZ, 花요일 (원곡: EXO-CBX (첸백시))) [THE SHOW 230328]",
      "group_ko": "엑소",
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
      "id": "08vzsuA6r5w",
      "title": "MC NAEggUZ, Bloomig Day (MC NAEggUZ, 花요일 (원곡: EXO-CBX (첸백시))) [THE SHOW 230328]",
      "group_ko": "에이티즈",
      "members": [
        "여상"
      ],
      "with_members": [
        "샤오쥔(웨이션브이)",
        "형섭(템페스트)"
      ],
      "with_groups": [
        "웨이션브이",
        "템페스트"
      ],
      "cover_of_groups": [
        "엑소"
      ],
      "cover_of_members": [
        "첸(엑소)",
        "백현(엑소)",
        "시우민(엑소)"
      ],
      "cover_of_song": "花요일 (Blooming Day)",
      "tags_manual": true,
      "cover_manual": true,
      "content_flag": null,
      "flag_source": null,
      "flagged_at": null
    }
  },
  {
    "id": "m3RCLQFeb7E",
    "action": "retag",
    "reason": "Mnet K-POP TMI SHOW 공식 설명: 김요한의 커버무대 재연",
    "before_state": {
      "id": "m3RCLQFeb7E",
      "title": "[ENG] [TMI SHOW/4회] ♥사랑해요 김요한♥ 레전드 커버 무대 재연! 김요한의 〈EXO - Love Shot〉#TMISHOW I EP.4 | Mnet 220302 방송",
      "group_ko": "엑소",
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
      "id": "m3RCLQFeb7E",
      "title": "[ENG] [TMI SHOW/4회] ♥사랑해요 김요한♥ 레전드 커버 무대 재연! 김요한의 〈EXO - Love Shot〉#TMISHOW I EP.4 | Mnet 220302 방송",
      "group_ko": "위아이",
      "members": [
        "김요한"
      ],
      "with_members": [],
      "with_groups": [],
      "cover_of_groups": [
        "엑소"
      ],
      "cover_of_members": [],
      "cover_of_song": "Love Shot",
      "tags_manual": true,
      "cover_manual": true,
      "content_flag": null,
      "flag_source": null,
      "flagged_at": null
    }
  },
  {
    "id": "jTYtwkHzBi4",
    "action": "retag",
    "reason": "THE IDOL × Nikon 원 업로드 제목 료·재희, 설명 #nctwish",
    "before_state": {
      "id": "jTYtwkHzBi4",
      "title": "엔시티위시 료 재희, 엑소 ''첫 눈'' 커버",
      "group_ko": "엑소",
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
      "id": "jTYtwkHzBi4",
      "title": "엔시티위시 료 재희, 엑소 ''첫 눈'' 커버",
      "group_ko": "엔시티 위시",
      "members": [
        "료",
        "재희"
      ],
      "with_members": [],
      "with_groups": [],
      "cover_of_groups": [
        "엑소"
      ],
      "cover_of_members": [],
      "cover_of_song": "첫눈",
      "tags_manual": true,
      "cover_manual": true,
      "content_flag": null,
      "flag_source": null,
      "flagged_at": null
    }
  },
  {
    "id": "6sMDnNYSSEE",
    "action": "retag",
    "reason": "M2 공식 설명: 오지구영 보이넥스트도어 편, 리우 커버",
    "before_state": {
      "id": "6sMDnNYSSEE",
      "title": "EXO ''Cream Soda'' 리우가 말아 주는 청량한 크림 소다 커버 | 오지구영 #shorts",
      "group_ko": "엑소",
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
      "id": "6sMDnNYSSEE",
      "title": "EXO ''Cream Soda'' 리우가 말아 주는 청량한 크림 소다 커버 | 오지구영 #shorts",
      "group_ko": "보이넥스트도어",
      "members": [
        "리우"
      ],
      "with_members": [],
      "with_groups": [],
      "cover_of_groups": [
        "엑소"
      ],
      "cover_of_members": [],
      "cover_of_song": "Cream Soda",
      "tags_manual": true,
      "cover_manual": true,
      "content_flag": null,
      "flag_source": null,
      "flagged_at": null
    }
  },
  {
    "id": "_zcA8phBv1M",
    "action": "retag",
    "reason": "ALL THE K-POP Weekly Playlist 공식 설명 2AM 커버",
    "before_state": {
      "id": "_zcA8phBv1M",
      "title": "[Weekly Playlist] 2am이 부르는 ＜방탄소년단 - Permission to Dance＞ 커버 무대♬ Full ver. l EP.538",
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
      "id": "_zcA8phBv1M",
      "title": "[Weekly Playlist] 2am이 부르는 ＜방탄소년단 - Permission to Dance＞ 커버 무대♬ Full ver. l EP.538",
      "group_ko": "2AM",
      "members": [],
      "with_members": [],
      "with_groups": [],
      "cover_of_groups": [
        "방탄소년단"
      ],
      "cover_of_members": [],
      "cover_of_song": "Permission to Dance",
      "tags_manual": true,
      "cover_manual": true,
      "content_flag": null,
      "flag_source": null,
      "flagged_at": null
    }
  },
  {
    "id": "2Rm9E1OWutI",
    "action": "retag",
    "reason": "KBS CoolFM STATION Z 공식 제목 우아 공연·소녀시대 원곡 구분",
    "before_state": {
      "id": "2Rm9E1OWutI",
      "title": "💫스젵 노래방 LIVE | 우아(woo!ah!)의 ‘Kissing You’ | 원곡: 소녀시대 | STATION Z | KBS 220618 방송",
      "group_ko": "소녀시대",
      "members": [],
      "with_members": [],
      "with_groups": [
        "우아"
      ],
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
      "id": "2Rm9E1OWutI",
      "title": "💫스젵 노래방 LIVE | 우아(woo!ah!)의 ‘Kissing You’ | 원곡: 소녀시대 | STATION Z | KBS 220618 방송",
      "group_ko": "우아",
      "members": [],
      "with_members": [],
      "with_groups": [],
      "cover_of_groups": [
        "소녀시대"
      ],
      "cover_of_members": [],
      "cover_of_song": "Kissing You",
      "tags_manual": true,
      "cover_manual": true,
      "content_flag": null,
      "flag_source": null,
      "flagged_at": null
    }
  },
  {
    "id": "QKPE4M1szmU",
    "action": "retag",
    "reason": "FNCEnt 공식 설명 Cherry Bullet Quest 커버 연습 영상",
    "before_state": {
      "id": "QKPE4M1szmU",
      "title": "Cherry Bullet - [COVER] 소녀시대 ‘다시 만난 세계’ PRACTICE VIDEO (Live Ver.)",
      "group_ko": "소녀시대",
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
      "id": "QKPE4M1szmU",
      "title": "Cherry Bullet - [COVER] 소녀시대 ‘다시 만난 세계’ PRACTICE VIDEO (Live Ver.)",
      "group_ko": "체리블렛",
      "members": [],
      "with_members": [],
      "with_groups": [],
      "cover_of_groups": [
        "소녀시대"
      ],
      "cover_of_members": [],
      "cover_of_song": "다시 만난 세계",
      "tags_manual": true,
      "cover_manual": true,
      "content_flag": null,
      "flag_source": null,
      "flagged_at": null
    }
  },
  {
    "id": "VDzOKzQgaao",
    "action": "retag",
    "reason": "1theK 공식 수빈 직캠: WJSN SOOBIN Dance Cover",
    "before_state": {
      "id": "VDzOKzQgaao",
      "title": "우주소녀 수빈 미스터 츄 직캠 | WJSN SOOBIN fancam | 에이핑크(Apink) | Mr. Chu | 올라운돌(All Rounder IDOL) | Dance Cover",
      "group_ko": "에이핑크",
      "members": [],
      "with_members": [
        "수빈(우주소녀)"
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
      "id": "VDzOKzQgaao",
      "title": "우주소녀 수빈 미스터 츄 직캠 | WJSN SOOBIN fancam | 에이핑크(Apink) | Mr. Chu | 올라운돌(All Rounder IDOL) | Dance Cover",
      "group_ko": "우주소녀",
      "members": [
        "수빈"
      ],
      "with_members": [],
      "with_groups": [],
      "cover_of_groups": [
        "에이핑크"
      ],
      "cover_of_members": [],
      "cover_of_song": "Mr. Chu",
      "tags_manual": true,
      "cover_manual": true,
      "content_flag": null,
      "flag_source": null,
      "flagged_at": null
    }
  },
  {
    "id": "RGHDfPDM7t8",
    "action": "retag",
    "reason": "1theK 공식 루다 직캠: WJSN LUDA Dance Cover, 출연/원곡 뒤바뀜",
    "before_state": {
      "id": "RGHDfPDM7t8",
      "title": "우주소녀 루다 ''미스터 츄'' 직캠 | WJSN LUDA fancam | 에이핑크(Apink) | Mr. Chu | 올라운돌(All Rounder IDOL) | Dance Cover",
      "group_ko": "에이핑크",
      "members": [],
      "with_members": [],
      "with_groups": [],
      "cover_of_groups": [
        "우주소녀"
      ],
      "cover_of_members": [],
      "cover_of_song": "미스터 츄",
      "tags_manual": false,
      "cover_manual": false,
      "content_flag": null,
      "flag_source": null,
      "flagged_at": null
    },
    "after_state": {
      "id": "RGHDfPDM7t8",
      "title": "우주소녀 루다 ''미스터 츄'' 직캠 | WJSN LUDA fancam | 에이핑크(Apink) | Mr. Chu | 올라운돌(All Rounder IDOL) | Dance Cover",
      "group_ko": "우주소녀",
      "members": [
        "루다"
      ],
      "with_members": [],
      "with_groups": [],
      "cover_of_groups": [
        "에이핑크"
      ],
      "cover_of_members": [],
      "cover_of_song": "Mr. Chu",
      "tags_manual": true,
      "cover_manual": true,
      "content_flag": null,
      "flag_source": null,
      "flagged_at": null
    }
  },
  {
    "id": "pD-3bQTXczA",
    "action": "retag",
    "reason": "1theK 공식 우주소녀 단체 미스터 츄 커버",
    "before_state": {
      "id": "pD-3bQTXczA",
      "title": "Butterfly처럼 날아온 우주소녀의 미스터 츄 커버 (feat. 테니스복) | WJSN | 에이핑크(Apink) | Mr. Chu | 올라운돌 | Dance Cover",
      "group_ko": "에이핑크",
      "members": [],
      "with_members": [],
      "with_groups": [
        "우주소녀"
      ],
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
      "id": "pD-3bQTXczA",
      "title": "Butterfly처럼 날아온 우주소녀의 미스터 츄 커버 (feat. 테니스복) | WJSN | 에이핑크(Apink) | Mr. Chu | 올라운돌 | Dance Cover",
      "group_ko": "우주소녀",
      "members": [],
      "with_members": [],
      "with_groups": [],
      "cover_of_groups": [
        "에이핑크"
      ],
      "cover_of_members": [],
      "cover_of_song": "Mr. Chu",
      "tags_manual": true,
      "cover_manual": true,
      "content_flag": null,
      "flag_source": null,
      "flagged_at": null
    }
  },
  {
    "id": "PFf0E7vKHx0",
    "action": "retag",
    "reason": "ALL THE K-POP 공식 와장찬(Y·장준·주찬) 커버 직캠, 오렌지캬라멜은 원곡",
    "before_state": {
      "id": "PFf0E7vKHx0",
      "title": "[주간아 직캠] 골든차일드 ''와장찬(Y, 장준, 주찬)''의 오렌지캬라멜 ＜마법소녀＞ 커버 직캠 Ver. l EP.574",
      "group_ko": "골든차일드",
      "members": [
        "이장준",
        "홍주찬"
      ],
      "with_members": [
        "레이나(애프터스쿨)",
        "나나(애프터스쿨)",
        "리지(애프터스쿨)"
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
      "id": "PFf0E7vKHx0",
      "title": "[주간아 직캠] 골든차일드 ''와장찬(Y, 장준, 주찬)''의 오렌지캬라멜 ＜마법소녀＞ 커버 직캠 Ver. l EP.574",
      "group_ko": "골든차일드",
      "members": [
        "Y",
        "이장준",
        "홍주찬"
      ],
      "with_members": [],
      "with_groups": [],
      "cover_of_groups": [
        "애프터스쿨"
      ],
      "cover_of_members": [
        "레이나(애프터스쿨)",
        "나나(애프터스쿨)",
        "리지(애프터스쿨)"
      ],
      "cover_of_song": "마법소녀",
      "tags_manual": true,
      "cover_manual": true,
      "content_flag": null,
      "flag_source": null,
      "flagged_at": null
    }
  },
  {
    "id": "ALRdzrC6Hr0",
    "action": "retag",
    "reason": "Golden Child 공식 김지범 COVER, Y는 원곡자",
    "before_state": {
      "id": "ALRdzrC6Hr0",
      "title": "김지범(Golden Child) - ''바람이라면'' COVER (원곡 : Y)",
      "group_ko": "골든차일드",
      "members": [
        "Y",
        "김지범"
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
      "id": "ALRdzrC6Hr0",
      "title": "김지범(Golden Child) - ''바람이라면'' COVER (원곡 : Y)",
      "group_ko": "골든차일드",
      "members": [
        "김지범"
      ],
      "with_members": [],
      "with_groups": [],
      "cover_of_groups": [],
      "cover_of_members": [
        "Y(골든차일드)"
      ],
      "cover_of_song": "바람이라면",
      "tags_manual": true,
      "cover_manual": true,
      "content_flag": null,
      "flag_source": null,
      "flagged_at": null
    }
  },
  {
    "id": "Y0nHVkxjytE",
    "action": "retag",
    "reason": "MBCkpop 공식 가희 솔로 Its Me; 기존 가희 솔로 저장 형식과 일치시킴",
    "before_state": {
      "id": "Y0nHVkxjytE",
      "title": "KAHI - its me, 가희 - 잇츠미, Show Champion 20131030",
      "group_ko": "애프터스쿨",
      "members": [],
      "with_members": [
        "가희(가희)"
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
      "id": "Y0nHVkxjytE",
      "title": "KAHI - its me, 가희 - 잇츠미, Show Champion 20131030",
      "group_ko": "가희",
      "members": [
        "가희"
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
    "id": "jWlJsZMrNs4",
    "action": "retag",
    "reason": "MBCkpop 공식 가희 솔로 Its Me; 나나의 동반 출연으로 연결하지 않음",
    "before_state": {
      "id": "jWlJsZMrNs4",
      "title": "Kahi - It''s Me, 가희 - 잇츠미 Music Core 20131012",
      "group_ko": "애프터스쿨",
      "members": [],
      "with_members": [
        "가희(가희)"
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
      "id": "jWlJsZMrNs4",
      "title": "Kahi - It''s Me, 가희 - 잇츠미 Music Core 20131012",
      "group_ko": "가희",
      "members": [
        "가희"
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
    "id": "Zc3LS419_sw",
    "action": "retag",
    "reason": "KBS CoolFM 공식 TAN 공연·Block B 원곡 구분",
    "before_state": {
      "id": "Zc3LS419_sw",
      "title": "💫스젵 노래방 LIVE | TAN의 ‘YESTERDAY’ | 원곡: Block B | STATION Z | KBS 220709 방송",
      "group_ko": "블락비",
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
      "id": "Zc3LS419_sw",
      "title": "💫스젵 노래방 LIVE | TAN의 ‘YESTERDAY’ | 원곡: Block B | STATION Z | KBS 220709 방송",
      "group_ko": "티에이엔",
      "members": [],
      "with_members": [],
      "with_groups": [],
      "cover_of_groups": [
        "블락비"
      ],
      "cover_of_members": [],
      "cover_of_song": "YESTERDAY",
      "tags_manual": true,
      "cover_manual": true,
      "content_flag": null,
      "flag_source": null,
      "flagged_at": null
    }
  },
  {
    "id": "2tkcsLmxhT0",
    "action": "exclude",
    "reason": "SBS 공식 SMTR25 연습생 커버, SMTR25 미등록; 엑소 공연 아님",
    "before_state": {
      "id": "2tkcsLmxhT0",
      "title": "‘방송 최초 공개’ SMTR25, SM 연습생 25명의 특별한 ＜EXO - 으르렁＞ 커버 무대★",
      "group_ko": "엑소",
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
      "id": "2tkcsLmxhT0",
      "title": "‘방송 최초 공개’ SMTR25, SM 연습생 25명의 특별한 ＜EXO - 으르렁＞ 커버 무대★",
      "group_ko": "엑소",
      "members": [],
      "with_members": [],
      "with_groups": [],
      "cover_of_groups": [],
      "cover_of_members": [],
      "cover_of_song": null,
      "tags_manual": false,
      "cover_manual": false,
      "content_flag": "무관",
      "flag_source": "manual",
      "flagged_at": null
    }
  },
  {
    "id": "WBEX1Zrqw9Q",
    "action": "exclude",
    "reason": "KGMA_OFFICIAL SMTR25 늑대와 미녀 cover; SMTR25 미등록",
    "before_state": {
      "id": "WBEX1Zrqw9Q",
      "title": "EXO – 늑대와 미녀 #SMTR25 cover 🐺",
      "group_ko": "엑소",
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
      "id": "WBEX1Zrqw9Q",
      "title": "EXO – 늑대와 미녀 #SMTR25 cover 🐺",
      "group_ko": "엑소",
      "members": [],
      "with_members": [],
      "with_groups": [],
      "cover_of_groups": [],
      "cover_of_members": [],
      "cover_of_song": null,
      "tags_manual": false,
      "cover_manual": false,
      "content_flag": "무관",
      "flag_source": "manual",
      "flagged_at": null
    }
  },
  {
    "id": "UC0_t-7Uk5o",
    "action": "exclude",
    "reason": "Mnet 공식 SM Trainee EXO Cover #SMTR25; SMTR25 미등록",
    "before_state": {
      "id": "UC0_t-7Uk5o",
      "title": "슴 연습생 엑소 커버 근본 있으시다 | 응답하라 하이스쿨",
      "group_ko": "엑소",
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
      "id": "UC0_t-7Uk5o",
      "title": "슴 연습생 엑소 커버 근본 있으시다 | 응답하라 하이스쿨",
      "group_ko": "엑소",
      "members": [],
      "with_members": [],
      "with_groups": [],
      "cover_of_groups": [],
      "cover_of_members": [],
      "cover_of_song": null,
      "tags_manual": false,
      "cover_manual": false,
      "content_flag": "무관",
      "flag_source": "manual",
      "flagged_at": null
    }
  },
  {
    "id": "t0Nc7vCXq4Y",
    "action": "exclude",
    "reason": "MUPLY 설명 Original Music EXO, 숨은 여성 보컬 커버; 가창자 미표기/미등록",
    "before_state": {
      "id": "t0Nc7vCXq4Y",
      "title": "Tempo(템포) - 엑소(EXO) COVER by 커버리스트",
      "group_ko": "엑소",
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
      "id": "t0Nc7vCXq4Y",
      "title": "Tempo(템포) - 엑소(EXO) COVER by 커버리스트",
      "group_ko": "엑소",
      "members": [],
      "with_members": [],
      "with_groups": [],
      "cover_of_groups": [],
      "cover_of_members": [],
      "cover_of_song": null,
      "tags_manual": false,
      "cover_manual": false,
      "content_flag": "무관",
      "flag_source": "manual",
      "flagged_at": null
    }
  },
  {
    "id": "lrVRMSxj1i8",
    "action": "exclude",
    "reason": "KUTV 고려대학교 응원단 으르렁 커버, 등록 아티스트 공연 아님",
    "before_state": {
      "id": "lrVRMSxj1i8",
      "title": "고려대학교 응원단은 진짜 유명한 으르렁임 🐯❤‍🔥 #고려대 #고려대학교 #응원단 #EXO #으르렁 #커버 #고연전 #응원 #응원곡",
      "group_ko": "엑소",
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
      "id": "lrVRMSxj1i8",
      "title": "고려대학교 응원단은 진짜 유명한 으르렁임 🐯❤‍🔥 #고려대 #고려대학교 #응원단 #EXO #으르렁 #커버 #고연전 #응원 #응원곡",
      "group_ko": "엑소",
      "members": [],
      "with_members": [],
      "with_groups": [],
      "cover_of_groups": [],
      "cover_of_members": [],
      "cover_of_song": null,
      "tags_manual": false,
      "cover_manual": false,
      "content_flag": "무관",
      "flag_source": "manual",
      "flagged_at": null
    }
  },
  {
    "id": "zFcISopPlww",
    "action": "exclude",
    "reason": "IDOL RADIO 공식 2Z Black Swan 커버, 2Z 미등록",
    "before_state": {
      "id": "zFcISopPlww",
      "title": "[IDOL RADIO] 200128 2Z(투지) - Black Swan (BTS) cover /아이돌 라디오 직캠",
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
      "id": "zFcISopPlww",
      "title": "[IDOL RADIO] 200128 2Z(투지) - Black Swan (BTS) cover /아이돌 라디오 직캠",
      "group_ko": "방탄소년단",
      "members": [],
      "with_members": [],
      "with_groups": [],
      "cover_of_groups": [],
      "cover_of_members": [],
      "cover_of_song": null,
      "tags_manual": false,
      "cover_manual": false,
      "content_flag": "무관",
      "flag_source": "manual",
      "flagged_at": null
    }
  },
  {
    "id": "0ppmuiaY1DM",
    "action": "exclude",
    "reason": "1theK 고막소년단 봄날 커버, 폴킴·김민석·정승환·하현상·BIG Naughty 미등록",
    "before_state": {
      "id": "0ppmuiaY1DM",
      "title": "BTS _ 봄날 (Spring Day) Cover | 폴킴 김민석 정승환 하현상 BIG Naughty | [고막소년단 Ep.0] GOMAK BOYS",
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
      "id": "0ppmuiaY1DM",
      "title": "BTS _ 봄날 (Spring Day) Cover | 폴킴 김민석 정승환 하현상 BIG Naughty | [고막소년단 Ep.0] GOMAK BOYS",
      "group_ko": "방탄소년단",
      "members": [],
      "with_members": [],
      "with_groups": [],
      "cover_of_groups": [],
      "cover_of_members": [],
      "cover_of_song": null,
      "tags_manual": false,
      "cover_manual": false,
      "content_flag": "무관",
      "flag_source": "manual",
      "flagged_at": null
    }
  },
  {
    "id": "XCGQx58v4TI",
    "action": "exclude",
    "reason": "SBS Radio 공식 로시 Butter 커버, 로시 미등록",
    "before_state": {
      "id": "XCGQx58v4TI",
      "title": "🎸기타와 함께하는 로시(Rothy)의 버터(Butter)🧈 | 원곡 : BTS (방탄소년단) | 최화정의 파워타임 #shorts",
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
      "id": "XCGQx58v4TI",
      "title": "🎸기타와 함께하는 로시(Rothy)의 버터(Butter)🧈 | 원곡 : BTS (방탄소년단) | 최화정의 파워타임 #shorts",
      "group_ko": "방탄소년단",
      "members": [],
      "with_members": [],
      "with_groups": [],
      "cover_of_groups": [],
      "cover_of_members": [],
      "cover_of_song": null,
      "tags_manual": false,
      "cover_manual": false,
      "content_flag": "무관",
      "flag_source": "manual",
      "flagged_at": null
    }
  },
  {
    "id": "OJxw-lKkdhI",
    "action": "exclude",
    "reason": "THE K-POP THE IDOL BAND P.O.P FIRE GROUND 경연 무대, 블락비 P.O 공연 아님; P.O.P 미등록",
    "before_state": {
      "id": "OJxw-lKkdhI",
      "title": "[THE IDOL BAND / 무대 풀버전] 🎤P.O.P - FIRE GROUND (원곡:오피셜히게단디즘(Official髭男dism))",
      "group_ko": "블락비",
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
      "id": "OJxw-lKkdhI",
      "title": "[THE IDOL BAND / 무대 풀버전] 🎤P.O.P - FIRE GROUND (원곡:오피셜히게단디즘(Official髭男dism))",
      "group_ko": "블락비",
      "members": [],
      "with_members": [],
      "with_groups": [],
      "cover_of_groups": [],
      "cover_of_members": [],
      "cover_of_song": null,
      "tags_manual": false,
      "cover_manual": false,
      "content_flag": "무관",
      "flag_source": "manual",
      "flagged_at": null
    }
  },
  {
    "id": "VLjmDsTbA38",
    "action": "exclude",
    "reason": "THE K-POP THE IDOL BAND P.O.P FIRE GROUND 경연 무대, 블락비 공연 아님; P.O.P 미등록",
    "before_state": {
      "id": "VLjmDsTbA38",
      "title": "[4회] 🎤P.O.P – FIRE GROUND (원곡:오피셜히게단디즘(Official髭男dism))",
      "group_ko": "블락비",
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
      "id": "VLjmDsTbA38",
      "title": "[4회] 🎤P.O.P – FIRE GROUND (원곡:오피셜히게단디즘(Official髭男dism))",
      "group_ko": "블락비",
      "members": [],
      "with_members": [],
      "with_groups": [],
      "cover_of_groups": [],
      "cover_of_members": [],
      "cover_of_song": null,
      "tags_manual": false,
      "cover_manual": false,
      "content_flag": "무관",
      "flag_source": "manual",
      "flagged_at": null
    }
  }
]'::jsonb;
  p record; current_state jsonb; actual_state jsonb;
  desired public.yt_channel_videos%ROWTYPE;
  n_changed integer := 0; n_already integer := 0;
BEGIN
  PERFORM set_config('lock_timeout','5s',true);
  PERFORM set_config('statement_timeout','30s',true);
  -- 임시표 없이 한 DO 문 안에서 계획과 갱신을 처리. 문장별 실행에도 안전.
  SELECT jsonb_agg(CASE WHEN item->>'action'='exclude'
    THEN jsonb_set(item,'{after_state,flagged_at}',to_jsonb(transaction_timestamp()))
    ELSE item END) INTO plan FROM jsonb_array_elements(plan) AS q(item);
  CREATE TABLE IF NOT EXISTS public.ops_codex_audit6_backup_20261026 (
    video_id text PRIMARY KEY, before_state jsonb NOT NULL, after_state jsonb NOT NULL,
    reason text NOT NULL, applied_at timestamptz NOT NULL, undone_at timestamptz
  );
  ALTER TABLE public.ops_codex_audit6_backup_20261026 ENABLE ROW LEVEL SECURITY;
  REVOKE ALL ON TABLE public.ops_codex_audit6_backup_20261026 FROM PUBLIC, anon, authenticated;
  -- 모든 대상의 현재 상태와 잠금을 먼저 확인. 한 건이라도 불일치하면 전체 중단.
  FOR p IN SELECT * FROM jsonb_to_recordset(plan) AS t(id text,action text,reason text,before_state jsonb,after_state jsonb) ORDER BY id LOOP
    SELECT to_jsonb(v) INTO current_state FROM public.yt_channel_videos v WHERE v.id = p.id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Missing audited video: %', p.id; END IF;
    SELECT jsonb_object_agg(k,current_state->k) INTO actual_state FROM jsonb_object_keys(p.before_state) AS keys(k);
    IF (p.action = 'exclude' AND actual_state - 'flagged_at' = p.after_state - 'flagged_at')
       OR (p.action <> 'exclude' AND actual_state = p.after_state) THEN
      n_already := n_already + 1;
    ELSIF actual_state IS DISTINCT FROM p.before_state THEN
      RAISE EXCEPTION 'Audited state changed; review before retry: %', p.id;
    ELSIF EXISTS (SELECT 1 FROM public.ops_codex_audit6_backup_20261026 b WHERE b.video_id=p.id) THEN
      RAISE EXCEPTION 'Existing backup for changed/restored row; review: %', p.id;
    END IF;
  END LOOP;

  FOR p IN SELECT * FROM jsonb_to_recordset(plan) AS t(id text,action text,reason text,before_state jsonb,after_state jsonb) ORDER BY id LOOP
    SELECT (SELECT jsonb_object_agg(k, to_jsonb(v)->k) FROM jsonb_object_keys(p.before_state) AS keys(k)) INTO actual_state FROM public.yt_channel_videos v WHERE v.id=p.id;
    IF (p.action = 'exclude' AND actual_state - 'flagged_at' = p.after_state - 'flagged_at')
       OR (p.action <> 'exclude' AND actual_state = p.after_state) THEN CONTINUE; END IF;
    INSERT INTO public.ops_codex_audit6_backup_20261026(video_id,before_state,after_state,reason,applied_at)
      VALUES(p.id,actual_state,p.after_state,p.reason,transaction_timestamp());
    SELECT * INTO desired FROM jsonb_populate_record(NULL::public.yt_channel_videos,p.after_state);
    -- 기존 관리자 저장 경로와 동일: 잠금 해제 → 정정 → 수동 확정 잠금.
    UPDATE public.yt_channel_videos SET tags_manual=false WHERE id=p.id;
    UPDATE public.yt_channel_videos SET
      group_ko = desired.group_ko,
      members = desired.members,
      with_members = desired.with_members,
      with_groups = desired.with_groups,
      cover_of_groups = desired.cover_of_groups,
      cover_of_members = desired.cover_of_members,
      cover_of_song = desired.cover_of_song,
      content_flag = desired.content_flag,
      flag_source = desired.flag_source,
      flagged_at = desired.flagged_at,
      tags_manual=false, cover_manual=desired.cover_manual
    WHERE id=p.id;
    UPDATE public.yt_channel_videos SET tags_manual=desired.tags_manual WHERE id=p.id;
    SELECT (SELECT jsonb_object_agg(k, to_jsonb(v)->k) FROM jsonb_object_keys(p.before_state) AS keys(k)) INTO actual_state FROM public.yt_channel_videos v WHERE v.id=p.id;
    IF actual_state IS DISTINCT FROM p.after_state THEN
      RAISE EXCEPTION 'Post-update verification failed (trigger/constraint): %',p.id;
    END IF;
    n_changed := n_changed + 1;
  END LOOP;
  RAISE NOTICE 'Changed %, already correct % (total 26)',n_changed,n_already;
END
$audit$;

-- 실행 결과 확인 전용: 이 SELECT만 따로 실행해도 됨. DB 쓰기 없음.
-- 정상: target_count=26 / not_correct=0 / manually_excluded=10.
WITH expected(id,action,after_state) AS (VALUES
('hIHioYAlU64','retag','{"id":"hIHioYAlU64","title":"💫 스젵 노래방 LIVE | 미래소년의 ‘첫눈’ | 원곡 : EXO(엑소) | STATION Z | KBS 230107 방송","group_ko":"미래소년","members":[],"with_members":[],"with_groups":[],"cover_of_groups":["엑소"],"cover_of_members":[],"cover_of_song":"첫눈","tags_manual":true,"cover_manual":true,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb),
('08vzsuA6r5w','retag','{"id":"08vzsuA6r5w","title":"MC NAEggUZ, Bloomig Day (MC NAEggUZ, 花요일 (원곡: EXO-CBX (첸백시))) [THE SHOW 230328]","group_ko":"에이티즈","members":["여상"],"with_members":["샤오쥔(웨이션브이)","형섭(템페스트)"],"with_groups":["웨이션브이","템페스트"],"cover_of_groups":["엑소"],"cover_of_members":["첸(엑소)","백현(엑소)","시우민(엑소)"],"cover_of_song":"花요일 (Blooming Day)","tags_manual":true,"cover_manual":true,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb),
('m3RCLQFeb7E','retag','{"id":"m3RCLQFeb7E","title":"[ENG] [TMI SHOW/4회] ♥사랑해요 김요한♥ 레전드 커버 무대 재연! 김요한의 〈EXO - Love Shot〉#TMISHOW I EP.4 | Mnet 220302 방송","group_ko":"위아이","members":["김요한"],"with_members":[],"with_groups":[],"cover_of_groups":["엑소"],"cover_of_members":[],"cover_of_song":"Love Shot","tags_manual":true,"cover_manual":true,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb),
('jTYtwkHzBi4','retag','{"id":"jTYtwkHzBi4","title":"엔시티위시 료 재희, 엑소 ''첫 눈'' 커버","group_ko":"엔시티 위시","members":["료","재희"],"with_members":[],"with_groups":[],"cover_of_groups":["엑소"],"cover_of_members":[],"cover_of_song":"첫눈","tags_manual":true,"cover_manual":true,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb),
('6sMDnNYSSEE','retag','{"id":"6sMDnNYSSEE","title":"EXO ''Cream Soda'' 리우가 말아 주는 청량한 크림 소다 커버 | 오지구영 #shorts","group_ko":"보이넥스트도어","members":["리우"],"with_members":[],"with_groups":[],"cover_of_groups":["엑소"],"cover_of_members":[],"cover_of_song":"Cream Soda","tags_manual":true,"cover_manual":true,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb),
('_zcA8phBv1M','retag','{"id":"_zcA8phBv1M","title":"[Weekly Playlist] 2am이 부르는 ＜방탄소년단 - Permission to Dance＞ 커버 무대♬ Full ver. l EP.538","group_ko":"2AM","members":[],"with_members":[],"with_groups":[],"cover_of_groups":["방탄소년단"],"cover_of_members":[],"cover_of_song":"Permission to Dance","tags_manual":true,"cover_manual":true,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb),
('2Rm9E1OWutI','retag','{"id":"2Rm9E1OWutI","title":"💫스젵 노래방 LIVE | 우아(woo!ah!)의 ‘Kissing You’ | 원곡: 소녀시대 | STATION Z | KBS 220618 방송","group_ko":"우아","members":[],"with_members":[],"with_groups":[],"cover_of_groups":["소녀시대"],"cover_of_members":[],"cover_of_song":"Kissing You","tags_manual":true,"cover_manual":true,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb),
('QKPE4M1szmU','retag','{"id":"QKPE4M1szmU","title":"Cherry Bullet - [COVER] 소녀시대 ‘다시 만난 세계’ PRACTICE VIDEO (Live Ver.)","group_ko":"체리블렛","members":[],"with_members":[],"with_groups":[],"cover_of_groups":["소녀시대"],"cover_of_members":[],"cover_of_song":"다시 만난 세계","tags_manual":true,"cover_manual":true,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb),
('VDzOKzQgaao','retag','{"id":"VDzOKzQgaao","title":"우주소녀 수빈 미스터 츄 직캠 | WJSN SOOBIN fancam | 에이핑크(Apink) | Mr. Chu | 올라운돌(All Rounder IDOL) | Dance Cover","group_ko":"우주소녀","members":["수빈"],"with_members":[],"with_groups":[],"cover_of_groups":["에이핑크"],"cover_of_members":[],"cover_of_song":"Mr. Chu","tags_manual":true,"cover_manual":true,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb),
('RGHDfPDM7t8','retag','{"id":"RGHDfPDM7t8","title":"우주소녀 루다 ''미스터 츄'' 직캠 | WJSN LUDA fancam | 에이핑크(Apink) | Mr. Chu | 올라운돌(All Rounder IDOL) | Dance Cover","group_ko":"우주소녀","members":["루다"],"with_members":[],"with_groups":[],"cover_of_groups":["에이핑크"],"cover_of_members":[],"cover_of_song":"Mr. Chu","tags_manual":true,"cover_manual":true,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb),
('pD-3bQTXczA','retag','{"id":"pD-3bQTXczA","title":"Butterfly처럼 날아온 우주소녀의 미스터 츄 커버 (feat. 테니스복) | WJSN | 에이핑크(Apink) | Mr. Chu | 올라운돌 | Dance Cover","group_ko":"우주소녀","members":[],"with_members":[],"with_groups":[],"cover_of_groups":["에이핑크"],"cover_of_members":[],"cover_of_song":"Mr. Chu","tags_manual":true,"cover_manual":true,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb),
('PFf0E7vKHx0','retag','{"id":"PFf0E7vKHx0","title":"[주간아 직캠] 골든차일드 ''와장찬(Y, 장준, 주찬)''의 오렌지캬라멜 ＜마법소녀＞ 커버 직캠 Ver. l EP.574","group_ko":"골든차일드","members":["Y","이장준","홍주찬"],"with_members":[],"with_groups":[],"cover_of_groups":["애프터스쿨"],"cover_of_members":["레이나(애프터스쿨)","나나(애프터스쿨)","리지(애프터스쿨)"],"cover_of_song":"마법소녀","tags_manual":true,"cover_manual":true,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb),
('ALRdzrC6Hr0','retag','{"id":"ALRdzrC6Hr0","title":"김지범(Golden Child) - ''바람이라면'' COVER (원곡 : Y)","group_ko":"골든차일드","members":["김지범"],"with_members":[],"with_groups":[],"cover_of_groups":[],"cover_of_members":["Y(골든차일드)"],"cover_of_song":"바람이라면","tags_manual":true,"cover_manual":true,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb),
('Y0nHVkxjytE','retag','{"id":"Y0nHVkxjytE","title":"KAHI - its me, 가희 - 잇츠미, Show Champion 20131030","group_ko":"가희","members":["가희"],"with_members":[],"with_groups":[],"cover_of_groups":[],"cover_of_members":[],"cover_of_song":null,"tags_manual":true,"cover_manual":false,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb),
('jWlJsZMrNs4','retag','{"id":"jWlJsZMrNs4","title":"Kahi - It''s Me, 가희 - 잇츠미 Music Core 20131012","group_ko":"가희","members":["가희"],"with_members":[],"with_groups":[],"cover_of_groups":[],"cover_of_members":[],"cover_of_song":null,"tags_manual":true,"cover_manual":false,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb),
('Zc3LS419_sw','retag','{"id":"Zc3LS419_sw","title":"💫스젵 노래방 LIVE | TAN의 ‘YESTERDAY’ | 원곡: Block B | STATION Z | KBS 220709 방송","group_ko":"티에이엔","members":[],"with_members":[],"with_groups":[],"cover_of_groups":["블락비"],"cover_of_members":[],"cover_of_song":"YESTERDAY","tags_manual":true,"cover_manual":true,"content_flag":null,"flag_source":null,"flagged_at":null}'::jsonb),
('2tkcsLmxhT0','exclude','{"id":"2tkcsLmxhT0","title":"‘방송 최초 공개’ SMTR25, SM 연습생 25명의 특별한 ＜EXO - 으르렁＞ 커버 무대★","group_ko":"엑소","members":[],"with_members":[],"with_groups":[],"cover_of_groups":[],"cover_of_members":[],"cover_of_song":null,"tags_manual":false,"cover_manual":false,"content_flag":"무관","flag_source":"manual","flagged_at":null}'::jsonb),
('WBEX1Zrqw9Q','exclude','{"id":"WBEX1Zrqw9Q","title":"EXO – 늑대와 미녀 #SMTR25 cover 🐺","group_ko":"엑소","members":[],"with_members":[],"with_groups":[],"cover_of_groups":[],"cover_of_members":[],"cover_of_song":null,"tags_manual":false,"cover_manual":false,"content_flag":"무관","flag_source":"manual","flagged_at":null}'::jsonb),
('UC0_t-7Uk5o','exclude','{"id":"UC0_t-7Uk5o","title":"슴 연습생 엑소 커버 근본 있으시다 | 응답하라 하이스쿨","group_ko":"엑소","members":[],"with_members":[],"with_groups":[],"cover_of_groups":[],"cover_of_members":[],"cover_of_song":null,"tags_manual":false,"cover_manual":false,"content_flag":"무관","flag_source":"manual","flagged_at":null}'::jsonb),
('t0Nc7vCXq4Y','exclude','{"id":"t0Nc7vCXq4Y","title":"Tempo(템포) - 엑소(EXO) COVER by 커버리스트","group_ko":"엑소","members":[],"with_members":[],"with_groups":[],"cover_of_groups":[],"cover_of_members":[],"cover_of_song":null,"tags_manual":false,"cover_manual":false,"content_flag":"무관","flag_source":"manual","flagged_at":null}'::jsonb),
('lrVRMSxj1i8','exclude','{"id":"lrVRMSxj1i8","title":"고려대학교 응원단은 진짜 유명한 으르렁임 🐯❤‍🔥 #고려대 #고려대학교 #응원단 #EXO #으르렁 #커버 #고연전 #응원 #응원곡","group_ko":"엑소","members":[],"with_members":[],"with_groups":[],"cover_of_groups":[],"cover_of_members":[],"cover_of_song":null,"tags_manual":false,"cover_manual":false,"content_flag":"무관","flag_source":"manual","flagged_at":null}'::jsonb),
('zFcISopPlww','exclude','{"id":"zFcISopPlww","title":"[IDOL RADIO] 200128 2Z(투지) - Black Swan (BTS) cover /아이돌 라디오 직캠","group_ko":"방탄소년단","members":[],"with_members":[],"with_groups":[],"cover_of_groups":[],"cover_of_members":[],"cover_of_song":null,"tags_manual":false,"cover_manual":false,"content_flag":"무관","flag_source":"manual","flagged_at":null}'::jsonb),
('0ppmuiaY1DM','exclude','{"id":"0ppmuiaY1DM","title":"BTS _ 봄날 (Spring Day) Cover | 폴킴 김민석 정승환 하현상 BIG Naughty | [고막소년단 Ep.0] GOMAK BOYS","group_ko":"방탄소년단","members":[],"with_members":[],"with_groups":[],"cover_of_groups":[],"cover_of_members":[],"cover_of_song":null,"tags_manual":false,"cover_manual":false,"content_flag":"무관","flag_source":"manual","flagged_at":null}'::jsonb),
('XCGQx58v4TI','exclude','{"id":"XCGQx58v4TI","title":"🎸기타와 함께하는 로시(Rothy)의 버터(Butter)🧈 | 원곡 : BTS (방탄소년단) | 최화정의 파워타임 #shorts","group_ko":"방탄소년단","members":[],"with_members":[],"with_groups":[],"cover_of_groups":[],"cover_of_members":[],"cover_of_song":null,"tags_manual":false,"cover_manual":false,"content_flag":"무관","flag_source":"manual","flagged_at":null}'::jsonb),
('OJxw-lKkdhI','exclude','{"id":"OJxw-lKkdhI","title":"[THE IDOL BAND / 무대 풀버전] 🎤P.O.P - FIRE GROUND (원곡:오피셜히게단디즘(Official髭男dism))","group_ko":"블락비","members":[],"with_members":[],"with_groups":[],"cover_of_groups":[],"cover_of_members":[],"cover_of_song":null,"tags_manual":false,"cover_manual":false,"content_flag":"무관","flag_source":"manual","flagged_at":null}'::jsonb),
('VLjmDsTbA38','exclude','{"id":"VLjmDsTbA38","title":"[4회] 🎤P.O.P – FIRE GROUND (원곡:오피셜히게단디즘(Official髭男dism))","group_ko":"블락비","members":[],"with_members":[],"with_groups":[],"cover_of_groups":[],"cover_of_members":[],"cover_of_song":null,"tags_manual":false,"cover_manual":false,"content_flag":"무관","flag_source":"manual","flagged_at":null}'::jsonb)
), checked AS (
  SELECT p.*,v.content_flag,v.flag_source,
    (SELECT jsonb_object_agg(k,to_jsonb(v)->k) FROM jsonb_object_keys(p.after_state) AS keys(k)) AS actual_state
  FROM expected p LEFT JOIN public.yt_channel_videos v ON v.id=p.id
)
SELECT count(*) AS target_count,
  count(*) FILTER (WHERE CASE WHEN action='exclude'
    THEN (actual_state-'flagged_at') IS DISTINCT FROM (after_state-'flagged_at')
    ELSE actual_state IS DISTINCT FROM after_state END) AS not_correct,
  count(*) FILTER (WHERE action='exclude' AND content_flag='무관' AND flag_source='manual') AS manually_excluded
FROM checked;
