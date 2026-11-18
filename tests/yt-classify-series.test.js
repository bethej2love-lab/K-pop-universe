// 프로그램명·시리즈 머리말·방송 클립 꼬리로 예능/퍼포먼스를 가른다(2026-11-18 사용자 "채널 하나에 여러 유형이 섞여
// 채널로는 못 정한다 — 프로그램명·키워드로 분류 보강"). 최근 30일 실측: 기타→예능 1,443 · 기타→퍼포먼스 418.
// 같은 프로그램(음악 토크쇼·방송사 클립)에 무대와 토크가 섞이므로 '가수 - 곡' 대시가 있으면 무대, 없으면 예능.
const fs = require('fs'), path = require('path'), vm = require('vm');
const js = fs.readFileSync(path.join(__dirname, '..', 'admin.js'), 'utf8');
const end = js.indexOf('// ── 세부 콘텐츠 포맷 태깅 (content_formats)');
if (end < 0) { console.log('❌ _ytClassify 블록을 못 찾음'); process.exit(1); }
const ctx = {}; vm.createContext(ctx); vm.runInContext(js.slice(0, end) + ';this._ytClassify=_ytClassify;', ctx);
let pass = true;
const cases = [
  ["[C.C.] INFINITE's incredible ramen! But the kimchi though... #INFINITE", 'variety'],
  ["[Real WG] Wonder Girls - WG in Paris Episode 4", 'variety'],
  ["izna gave Daegu's grilled tripe 110 out of 100 🔥 | Hidden Trip 2 EP.3", 'variety'],
  ["[⏱10초 10답] TEMPEST(템페스트) 한빈｜난장 (Dangerous)｜폭풍전야｜Stone Music+", 'variety'],
  ["(SUB) VICTON diary EP.111 ('Chronograph' 활동 2주 차 비하인드)", 'variety'],
  ["투어스 첫 만남 댄스 사실 성시경한테 영감받음 [더 시즌즈-성시경의 고막남친]", 'variety'],
  ["[세로] TWS (투어스) - 널 따라가 (You, You) (Band VER.) [더 시즌즈-성시경의 고막남친]", 'live'],
  ["UP - ATEEZ (에이티즈) | SBS 261115 방송", 'live'],
  ["[4K] ATEEZ(에이티즈) - Drip [불후의 명곡2 전설을 노래하다/Immortal Songs 2] | KBS 261031 방송", 'live'],
  ["A2O LITE - NEON l SHOW K-POP l EP.1 l 261019", 'live'],
  ["130914 Incheon sky festival BTS Jimin N.O multi cam", 'live'],
  ["[S영상] 컴백 스테이씨, '색안경' 무대", 'live'],
  // 그대로 기타여야 하는 것
  ["[Special Clip] 우주소녀(WJSN) - 2020 설날인사 (2020 New Year's Greetings)", 'other'],
  ["[#2026MAMA] CHAPTER 1 PERFORMING ARTIST #Hearts2Hearts", 'other'],
  // 음악방송 회차 번호는 무대(예능으로 가면 안 됨)
  ["[쇼챔직캠 4K] JAE CHAN(재찬) - Poster Boy | Show Champion | EP.555 | 250521", 'live'],
];
for (const [t, want] of cases) { const got = ctx._ytClassify(t); if (got !== want) { pass = false; console.log(`❌ ${t} → ${got} (기대 ${want})`); } else console.log(`✅ ${want.padEnd(7)} ${t}`); }
if (!pass) process.exit(1);
console.log('\n✅ 프로그램명·시리즈 분류 테스트 통과');
