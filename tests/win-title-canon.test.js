// 음방 1위 곡 제목 → 한국 활동 곡명(디스코 표기) 정리 가드(2026-11-11 사용자 "한국 활동 위주의 곡명이 중심", docs/NAMING.md).
// tools/wiki_music_wins.mjs의 _canonWinTitle을 그대로 떼어 실제 디스코·shared.js 별칭으로 돌린다(네트워크 없음).
// 실행: node tests/win-title-canon.test.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'tools/wiki_music_wins.mjs'), 'utf8');
const a = src.indexOf('const _vmCtx'), b = src.indexOf('\n}\n', src.indexOf('function _canonWinTitle')) + 3;
if (a < 0 || b < 3) { console.log('❌ _canonWinTitle 블록을 못 찾음'); process.exit(1); }
const G = JSON.parse(fs.readFileSync(path.join(ROOT, 'groups.json'), 'utf8'));
const A = JSON.parse(fs.readFileSync(path.join(ROOT, 'artists.json'), 'utf8'));
const ctx = { fs, path, vm, ROOT, G, arts: Array.isArray(A) ? A : Object.values(A), Object, String, JSON };
vm.createContext(ctx);
vm.runInContext(src.slice(a, b) + ';this.f=_canonWinTitle;', ctx);
let fail = 0;
const eq = (g, m, from, want) => { const got = ctx.f(g, m, from); const ok = got === want; if (!ok) fail++; console.log(`${ok ? '✅' : '❌'} ${g}${m ? '/' + m : ''} '${from}' → ${JSON.stringify(got)}${ok ? '' : ` (기대 ${JSON.stringify(want)})`}`); };
eq('레드벨벳', null, 'Red Flavor', '빨간 맛 (Red Flavor)');      // 괄호 속 영문
eq('아이브', null, 'Love Dive', 'LOVE DIVE');                   // 대소문자
eq('방탄소년단', null, 'Fire', '불타오르네 (FIRE)');               // 일본판 'FIRE (Japanese Ver.)'보다 한국 원곡
eq('방탄소년단', '뷔', 'Fri(end)s', 'FRI(END)S');                // 'Friends (호석 테마)' 같은 괄호 앞부분만 같은 곡은 안 고름
eq('투어스', null, 'Plot Twist', '첫 만남은 계획대로 되지 않아');   // 영문 별칭
eq('솔로', '아이유', 'Palette', '팔레트');                         // 솔로 별칭(주인=이름)
eq('투어스', null, 'OVERDRIVE', 'OVERDRIVE');                    // 이미 맞는 건 그대로
eq('투어스', null, 'Totally Unknown Song', null);                // 모르면 null(기존 처리로)
console.log(`\n${fail ? '❌' : '✅'} ${fail} 실패`);
process.exit(fail ? 1 : 0);
