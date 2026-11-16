// 재생 화면 자막(CC) 끄기 회귀 테스트 (2026-11-16, 사용자 "웹앱에서 CC가 또 켜진다")
// 실제 유튜브는 헤드리스로 재현할 수 없어서, 코드가 아래 세 가지를 지키는지만 고정한다.
//  ① 틀(iframe)을 새로 만들 때마다 끄기 기록을 비운다 — 같은 영상을 다시 열어도 끄기 신호를 다시 보낸다
//  ② 유튜브가 모듈을 붙일 때 보내는 onApiChange를 받아 즉시 끈다(첫 60초 한정)
//  ③ captions·cc 두 모듈 이름을 모두 내린다
// 실행: node tests/lb-captions-off.test.js
const path = require('path');
const { readIndexSource } = require(path.join(__dirname, '..', 'tools', 'index_source.cjs'));
const src = readIndexSource();
let pass = true;
const need = (ok, label) => { if (!ok) pass = false; console.log((ok ? '✅ ' : '❌ ') + label); };

const setSrc = /function _lbSetIframeSrc\(url\)\{[\s\S]*?\n\}/.exec(src);
need(!!setSrc && /_lbCcOffVid=null/.test(setSrc[0]), '① _lbSetIframeSrc가 새 틀마다 끄기 기록(_lbCcOffVid)을 비운다');
need(/d\.event==='onApiChange'&&Date\.now\(\)<_lbCcWatchUntil/.test(src), '② onApiChange를 받아 첫 60초 안이면 즉시 끈다');
need(/_lbCcWatchUntil=Date\.now\(\)\+60000/.test(src), '② 감시 구간이 60초로 한정돼 사용자가 켠 CC는 그 뒤 유지된다');
need(/\['captions','cc'\]\.forEach/.test(src), '③ captions·cc 모듈을 모두 내린다');
need(/cc_load_policy=0/.test(src), '임베드 주소에 cc_load_policy=0이 유지된다');
console.log(pass ? '🎉 자막 끄기 테스트 통과' : '❌ 자막 끄기 테스트 실패');
process.exit(pass ? 0 : 1);
