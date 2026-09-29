// "등록 이름 + 한국 성씨 = 다른 사람 풀네임" + 협찬 크레딧 제거 회귀 테스트 (2026-09-29)
//
// 사용자 제보 2건:
//  ① "제임스 안 (James An)"(가수 제임스 안) 외부 채널 영상 8건이 코르티스 제임스로 역추론됐다.
//  ② "THE FIRST TAKE powered by ASAHI SUPER DRY"(맥주 협찬) 4건이 트레저 아사히로 잡혔다.
// 둘 다 _atmStripCommonNounCtx(전 매처 공용 전처리)에서 막는다. 진짜 영상이 같이 죽지 않는지도 고정한다.
// 실행: node tests/other-person-fullname.test.js

const path = require('path');
const ROOT = path.join(__dirname, '..');
const { _m2ParseTitle, ARTISTS, GROUPS } = require(path.join(ROOT, 'tools/matcher_harness.cjs'));
const M2 = require(path.join(ROOT, 'tools/m2_harness.js')).load();
const ag = a => a.groups || [a.group];
const rosterFor = g => ARTISTS.filter(a => ag(a).some(x => x.ko === g)).map(a => { const e = ag(a).find(x => x.ko === g) || {}; return { ko: a.name.ko, en: a.name.en, left: (e.left !== undefined ? e.left : a.left), aliases: a.matchAliases }; });

let pass = true;
const has = (r, gko, mem) => {
  if (!r) return false;
  const s = JSON.stringify(r);
  return s.includes(`"${gko}"`) && (!mem || s.includes(`"${mem}"`));
};
// 태그는 두 경로의 합집합으로 붙는다 — 외부 채널 역추론(_m2ParseTitle) + 그 그룹 자체 채널 매칭(_atmResolveMembers).
// "잡혀야"는 둘 중 하나라도, "안 잡혀야"는 둘 다 안 잡혀야 통과.
const expect = (title, gko, mem, want) => {
  const r = _m2ParseTitle(title, undefined, false);
  const own = (mem && GROUPS[gko]) ? M2._atmResolveMembers(title, '', rosterFor(gko), gko) : [];
  const got = has(r, gko, mem) || own.includes(mem);
  const ok = got === want;
  if (!ok) pass = false;
  console.log(`${ok ? '✅' : '❌'} ${want ? '잡혀야' : '안 잡혀야'} ${gko}${mem ? ' ' + mem : ''} ← ${title}${ok ? '' : `\n    결과: ${JSON.stringify(r)}`}`);
};

// ── ① 제임스 안 — 다른 사람 ──
expect('제임스 안 (James An) - Sasha | K-Pop Live Session | The Archive', '코르티스', '제임스', false);
expect('James An(제임스 안) - Blue Ink, Hypocrite, A Streetcar Named Desire l HIJACK LIVE', '코르티스', '제임스', false);
expect('The Rehearsal with James An (제임스안)', '코르티스', '제임스', false);
// 진짜 코르티스 제임스는 그대로
expect("[안방1열 직캠4K] 코르티스 제임스 'REDRED' (CORTIS JAMES FanCam) @SBS Inkigayo 260510", '코르티스', '제임스', true);
expect('[UNFILTERED CAM] CORTIS JAMES(제임스) \'REDRED\' 4K | STUDIO CHOOM ORIGINAL', '코르티스', '제임스', true);
// "JAMES GO" — go는 영어 낱말이라 풀네임으로 보지 않는다
expect('CORTIS JAMES GO! FanCam', '코르티스', '제임스', true);
// "○○ 편 |"(에피소드) — 편은 성씨 목록에 있지만 일상어라 풀네임으로 보지 않는다
expect('[주간아이돌] 에스파 카리나 편 | 주간아이돌', '에스파', '카리나', true);
// 중국계 멤버 실명 표기 — Jackson Wang은 갓세븐 잭슨 본인(wang은 성 로마자 목록에서 뺐다)
expect('Jackson Wang  X Fendiman', '갓세븐', '잭슨', true);
// 한국 이름 로마자는 규칙 대상이 아니다 — 트레저 재혁 직캠의 "YOON JAE HYUK"
expect("[안방1열 직캠4K] 트레저 윤재혁 'MY TREASURE' (TREASURE YOON JAE HYUK FanCam)", '트레저', '재혁', true);
// 서양식 이름 + 성 = 다른 사람(현재 오태깅 사례)
expect('Eric Nam, Paradise (에릭남, 파라다이스) [THE SHOW 200811] UHD', '더보이즈', '에릭', false);
expect('바비킴(Bobby Kim) - 골목길(An alley) & 고래의 꿈', '아이콘', 'BOBBY', false);
// 그룹명이 같이 있으면 풀네임 표기여도 본인(NCT 마크 = 이민형)
expect('NCT 127 MARK LEE Fact Check FanCam', '엔시티 127', '마크', true);

// ── ①-b 긴 이름이 이긴다 — 로마자 풀네임 속 조각(han)이 짧은 이름(스키즈 한)으로 새지 않게 ──
expect("[MPD직캠] 한승우 직캠 4K 'Blooming' (HAN SEUNG WOO FanCam) | @MCOUNTDOWN", '스트레이키즈', '한', false);
expect("[MPD직캠] 도한세 직캠 4K 'TAKE OVER' (Do Han Se FanCam) | @MCOUNTDOWN", '스트레이키즈', '한', false);
expect('HAN SEUNGWOO(한승우) - Dive Into @인기가요 inkigayo 20230416', '스트레이키즈', '한', false);
// 로마자 런의 일부만 등록명과 맞는 경우 — 윤서령의 "YOON SEO"가 배드빌런 윤서가 되면 안 된다
expect("[안방1열 직캠4K] 윤서령 '슬픈가야금' (YOON SEO RYEONG FanCam) @SBS Inkigayo 250330", '배드빌런', '윤서', false);
expect("[안방1열 직캠4K] 윤서령 '슬픈가야금' (YOON SEO RYEONG FanCam) @SBS Inkigayo 250330", '스테이씨', '윤', false);
expect("[BOYS PLANET] 박한빈 PARK HAN BIN I K그룹 @타임어택 1분 자기소개", '스트레이키즈', '한', false);
expect('[6회/세로직캠/4K] 포에버 | #진현주 #JIN HYEONJU ♬WHATEVA', '방탄소년단', '진', false);
expect("[안방1열 직캠4K] 이진혁 '5K' (LEE JIN HYUK FanCam)│@SBS Inkigayo_2021.04.25.", '러블리즈', 'JIN', false);
expect("[안방1열 직캠4K] 이진혁 '5K' (LEE JIN HYUK FanCam)│@SBS Inkigayo_2021.04.25.", '핑클', '이진', false);
expect('[#음중풀캠] DAYOUNG X JAY PARK (다영 X 박재범) – FLIRTY FullCam', '엔하이픈', '제이', false);
// 등록된 풀네임은 본인으로 — 윤산하(아스트로)
expect("[얼빡직캠 4K] 윤산하 'EXTRA VIRGIN' (YOON SANHA Facecam) @뮤직뱅크", '아스트로', '윤산하', true);
// 본인인데 성 표기가 등록명과 다른 경우(1차 전수 점검 회귀) — 전부 본인으로 잡혀야
expect('ZEROBASEONE (제로베이스원) HAN BIN & JI WOONG ARENA KOREA Magazine', '제로베이스원', '성한빈', true);
expect('HOT (HONG EUNCHAE ver.) #LE_SSERAFIM', '르세라핌', '홍은채', true);
expect('TREASURE - [TMI_LOG] EP.15 CHOI HYUN SUK CAM', '트레저', '현석', true);
expect('Yes, I am Nayeon. #TWICE', '트와이스', '나연', true);
expect('[-note] 200802 NI-KI - ENHYPEN (엔하이픈)', '엔하이픈', '니키', true);
// 실명 성 + 이름 로마자로 쓴 본인(2차 전수 점검 회귀) — 전부 잡혀야
expect('JEON SOYEON - BEAM BEAM Fighting 2022 Special', '아이들', '소연', true);
expect('pov: ready to marry Choi San', '에이티즈', '산', true);
expect('🦁 YOON JAE HYUK #HELLOchallenge', '트레저', '재혁', true);
expect("Dreamcatcher(드림캐쳐) '2 Rings' (JI U CAM)", '드림캐쳐', '지유', true);
expect('[EPISODE] HONG EUNCHAE Doosan Bears First Pitch Behind', '르세라핌', '홍은채', true);
expect("ZEROBASEONE (제로베이스원) 'GOOD SO BAD' Shorterview 'KIM GYU VIN'", '제로베이스원', '김규빈', true);
expect("ONE PACT 원팩트 '180928~ (JAY CHANG Solo)' SPECIAL VIDEO", '원팩트', '제이 창', true);
// 3차 전수 점검 회귀 — 영문 풀네임 본인·동명이인 등록명
expect('[BANGTAN BOMB] How much ice cream did Jung Kook eat? - BTS (방탄소년단)', '방탄소년단', '정국', true);
expect('[📹] Behind H.O.W! ✨ JI HYUN MINI VLOG ✨#HEARTOFWOMAN #하트오브우먼', '하트오브우먼', '지현', true);
expect('[Fit Files] NCT Jaemin vs Straykids Lee Know—Two Ways to Wear', '스트레이키즈', '리노', true);
// 다른 사람 — 같은 이름 다른 성
expect('유니버스 티켓 | 이은채  LEE EUNCHAE 선공개 “개인 무대 직캠”', '르세라핌', '홍은채', false);
// 진짜 스키즈 한은 그대로
expect("[MPD직캠] 스트레이 키즈 한 직캠 4K 'MANIAC' (Stray Kids HAN FanCam)", '스트레이키즈', '한', true);

// ── ①-c "이유"(reason) vs 멤버 이유(힛지스) — 순찰에서 발견 ──
expect('폰 비번을 알려주면 안 되는 이유ㅣ#NALDID #날딧', '힛지스', '이유', false);
expect('술 마신 다음날 예뻐 보이는 이유', '에버글로우', '이유', false);
expect('[Hit-log] 이유가 교토에 간 이유🐤  l 힛지스의 휴가 브이로그', '힛지스', '이유', true);

// ── ①-d 이니셜 이름 I.N ≠ 영어 in — 순찰·차분에서 발견 ──
expect('Stray Kids (스트레이키즈) – Intro + 특 | 쇼! 음악중심 in JAPAN | MBC240717방송', '스트레이키즈', '아이엔', false);
expect('슼즈로운 제주생활 (SKZful Days in Jeju) #1｜[SKZ CODE] Ep.20', '스트레이키즈', '아이엔', false);
expect('[MPD직캠] 스트레이 키즈 아이엔 직캠 4K (Stray Kids I.N FanCam)', '스트레이키즈', '아이엔', true);

// ── ①-e 영문명이 흔한 영어 낱말 — 순찰 B가 먼저 발견 ──
// 외부 채널(음방·팬캠)에서 이름만으로 그룹을 역추론하던 경로를 막는다(_ATM_INFER_EXCLUDE_NAMES). 그룹 자체 채널 매칭은 별개.
const expectExt = (title, gko, want) => {
  const r = _m2ParseTitle(title, undefined, false);
  const got = !!r && (r.primaryGroup === gko || (r.withGroups || []).includes(gko));
  const ok = got === want; if (!ok) pass = false;
  console.log(`${ok ? '✅' : '❌'} ${want ? '역추론돼야' : '역추론 안 돼야'} ${gko} ← ${title}${ok ? '' : `\n    결과: ${JSON.stringify(r)}`}`);
};
expectExt("[FAN PICK CAM 4K]  OH YOOJIN ‘여우야 뭐하니’ [오유진] @THESHOW 260728 방송", '누에라', false);
// 4차 점검 회귀 — 외부 채널 역추론 경로(영문 풀네임만으로 그룹을 정하는 것)가 살아 있어야
expectExt('[Fit Files] NCT Jaemin vs Straykids Lee Know—Two Ways to Wear', '스트레이키즈', true);
expect('[BANGTAN BOMB] Just watching Jung Kook lip sync show - BTS (방탄소년단)', '방탄소년단', '정국', true);
expect('🐿️Burnin’ Tires🐥 #StrayKids #IN #아이엔', '스트레이키즈', '아이엔', true);
expect('[EXCLUSIVE] How do EXO shoot their music stage? (ENG)', '엑소', '디오', false);
expectExt("[안방1열 풀캠4K] 하티크 '일상' (Hat:q 'Life goes on' FullCam) @SBS Inkigayo", '올아워즈', false);

// ── ② 협찬 크레딧 ──
expect('白石麻衣 × 絢香 - にじいろ / THE FIRST TAKE powered by ASAHI SUPER DRY', '트레저', null, false);
expect('石崎ひゅーい - 花束 / THE FIRST TAKE powered by ASAHI SUPER DRY', '트레저', null, false);
// 진짜 아사히는 그대로
expect('#HELLOchallenge (YOON JAE HYUK & ASAHI ver.) #TREASURE', '트레저', null, true);

console.log(pass ? '\n🎉 다른 사람 풀네임·협찬 크레딧 테스트 통과' : '\n❌ 다른 사람 풀네임·협찬 크레딧 테스트 실패');
process.exit(pass ? 0 : 1);
