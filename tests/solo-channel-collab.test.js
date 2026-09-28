// 솔로 아티스트 자체 채널 콜라보 태깅 (2026-09-28)
//
// 자동 태깅(_ytAutoTagMembers)이 groups.json 그룹만 돌아서, 솔로 채널(디모렉스·싸이·아이유·승한…) 영상의 콜라보가
// with_members에 한 번도 안 붙었다 — 13명 3,902건 중 65건. 디모렉스 'Officially Cool'(X 윈터)도 비어 있었고,
// Surf "함께한 멤버"가 이걸 읽는다. 솔로를 넣으면서 실측으로 확인한 오매칭(에이프릴=April Fools'·다이아 버튼·
// 가수 BIBI·가수 윤하·아이유 본명 지은·"오렌지 태양")도 같이 막았다. 실제 매처를 돌린다.
const fs = require('fs');
const path = require('path');
const { _m2ParseTitle } = require(path.join(__dirname, '..', 'tools', 'matcher_harness.cjs'));
let pass = true;
const need = (c, m) => { console.log((c ? '✅ ' : '❌ ') + m); if (!c) pass = false; };
// 솔로 채널 기준 "다른 사람" 목록 — 자동 태깅 루프와 같은 방식(본인 제외)
const guests = (t, self, d = '2026-09-20') => {
  const r = _m2ParseTitle(t, self, undefined, d); if (!r) return [];
  return [r.primaryGroup, ...r.withGroups].filter(g => g && g !== self)
    .flatMap(g => ((r.membersByGroup[g] || []).filter(m => m !== self).map(m => `${m}(${g})`)).concat((r.membersByGroup[g] || []).length ? [] : [g]));
};

// 살려야 할 것 — 진짜 콜라보
need(guests("방예담 (BANG YEDAM) X 윈터 (WINTER of aespa) ‘Officially Cool’ Official M/V", '디모렉스').includes('윈터(에스파)'), '디모렉스 X 윈터');
need(guests("PSY - 'That That (prod. & feat. SUGA of BTS)' MV", '싸이').includes('슈가(방탄소년단)'), '싸이 feat. 슈가');
need(guests('별빛처럼 빛이나는✨#VIXX #혁 선배님 ☝🏻하나만 해‼️#방예담 #BANGYEDAM #하나만해 #ONLY_ONE #온리원 #빅스 #HYUK #한상혁', '디모렉스', '2023-11-28').includes('혁(빅스)'), '디모렉스 챌린지 #혁');
need(guests("IU 'Shh.. (Feat. HYEIN, 조원선 & Special Narr. 패티김)' MV", '아이유').includes('혜인(뉴진스)'), '아이유 feat. 혜인');
need(guests("#BTS #jhope THX to @BTS 싸이흠뻑쇼 #비비", '싸이').length > 0, '해시태그로 명시된 이름은 흔한단어라도 인정');

// 막아야 할 것 — 일반 표현·유니버스 밖 동명이인
const none = (t, self, bad, m) => need(!guests(t, self).some(x => x.includes(bad)), m);
none("[IU TV] 'dlwlrma.' Concert - Singapore (April Fools' Day Ver.)", '아이유', '에이프릴', "April Fools' → 에이프릴 아님");
none('SE7EN - 1st Look Magazine Cover Shoot (2012 April Issue)', '세븐', '에이프릴', 'April Issue → 에이프릴 아님');
none('드디어 도착한 💎다이아 버튼💎 #아이유 #IU', '아이유', '다이아', '다이아 버튼 → 다이아 아님');
none('서태지와 아이들 - Come Back Home | Choreography by XngHan&Xoul', '승한', '아이들', '서태지와 아이들 → (여자)아이들 아님');
none("[항공캠4K] 효연 'Second (Feat. 비비)' (HYO Sky Cam)", '효연', '비비', '효연 feat. 비비 → 가수 BIBI, 이달의소녀 비비 아님');
none('[아이유의 팔레트🎨] 수고했다 참 (With 윤하) Ep.29', '아이유', '방윤하', 'With 윤하 → 가수 윤하, 유니스 방윤하 아님');
none('[IU TV] 내 이름은 지은. 예리하죠', '아이유', '박지은', '지은 → 아이유 본명, 퍼플키스 박지은 아님');
none("[IU] '에잇(eight)' Live Clip (2022 IU Concert 'The Golden Hour : 오렌지 태양 아래')", '아이유', '태양', '오렌지 태양 → 빅뱅 태양 아님');
none('인스타 개설 이래 최다 DM #설아', '설아', '이래', '개설 이래 → 세븐어스 이래 아님');

// 루프가 솔로를 실제로 도는지(본인·본인 그룹 제외 포함)
const src = fs.readFileSync(path.join(__dirname, '..', 'admin.js'), 'utf8');
const body = src.slice(src.indexOf('async function _ytAutoTagMembers'), src.indexOf('async function _ytRetagAllIncludingTagged'));
need(/soloKos/.test(body) && /\.\.\.soloKos/.test(body), '자동 태깅 대상에 솔로 채널 포함');
need(/selfGroups\.has\(og\)/.test(body), '솔로 본인 그룹에서 본인만 잡힌 건 콜라보 제외');

console.log(pass ? '\n✅ 솔로 채널 콜라보 테스트 통과' : '\n💥 솔로 채널 콜라보 테스트 실패');
process.exit(pass ? 0 : 1);
