// 활동명·일본 이름은 성을 떼지 않는다 (2026-09-28)
//
// 매처가 첫 글자가 성씨 목록에 있기만 하면 이름을 "성+이름"으로 보고 떼서, 제이미→"이미"·유아이→"아이"·
// 조한국→"한국"·이정신→"정신" 같은 조각이 이름 변형이 됐다. "이미"가 들어간 외부 채널 영상이 전부 피프틴앤드
// 제이미로 역추론되는 등 멤버 태그 598건·게스트 태그 74건이 오염됐다(사용자 제보: "엄성현 붐은 이미 왔다").
// ⚠️ 실제 매처(tools/matcher_harness.cjs)를 돌린다 — 성 떼기는 예전에 한 번 건드렸다가 정상 태그 9,000건을
//    지운 적이 있는 민감한 곳이라, "막아야 할 것"과 "살려야 할 것"을 둘 다 고정한다.
const path = require('path');
const { _m2ParseTitle, _m2NameVariants, ARTISTS } = require(path.join(__dirname, '..', 'tools', 'matcher_harness.cjs'));
let pass = true;
const need = (c, m) => { console.log((c ? '✅ ' : '❌ ') + m); if (!c) pass = false; };
const V = n => _m2NameVariants(ARTISTS.find(a => a.name.ko === n));
const P = (t, d = '2026-09-20') => { const r = _m2ParseTitle(t, undefined, false, d); return r ? Object.values(r.membersByGroup || {}).flat() : []; };

// 막아야 할 것 — 활동명(제·마·사·소·선 시작)·일본 이름
for (const [n, bad] of [['제이미', '이미'], ['제시카', '시카'], ['사쿠라', '쿠라'], ['사쿠야', '쿠야'], ['마시로', '시로'], ['유우시', '우시']])
  need(!V(n).includes(bad), `${n}: "${bad}" 조각을 이름 변형으로 안 씀`);
// 살려야 할 것 — 한국 실명, 한글 표기가 성+이름인 중국·영미권 이름
for (const [n, good] of [['장원영', '원영'], ['김채원', '채원'], ['장하오', '하오'], ['석매튜', '매튜'], ['나캠든', '캠든']])
  need(V(n).includes(good), `${n}: "${good}"는 여전히 이름 변형(실제로 그렇게 불림)`);
// 제목 단위 — 일상어 조각은 그룹명 없으면 안 잡히고, 그룹명과 같이 오면 잡힌다
need(P('엄성현 붐은 이미 왔다').length === 0, '"…이미 왔다" → 제이미로 안 잡힘');
need(P('정신 바짝 차린 어린 선수들').length === 0, '"정신 바짝 차린" → 이정신으로 안 잡힘');
need(P('Ailee - U&I, 에일리 - 유 앤 아이').length === 0 || !P('Ailee - U&I, 에일리 - 유 앤 아이').includes('유아이'), '"유 앤 아이" → 유아이로 안 잡힘');
need(P('[MPD직캠] 제이미 직캠 4K STRESS (JAYME FanCam)').includes('제이미'), '진짜 제이미 직캠은 그대로 잡힘');
need(P('[입덕직캠] 에이프릴 나은 직캠 4K', '2020-05-01').includes('이나은'), '그룹명과 같이 오면 조각도 인정(에이프릴 나은 — 해체 전 날짜로)');
need(P('본업이 아이돌이었던 미주 #놀뭐').includes('이미주'), '"미주"는 막지 않음(러블리즈 이미주가 그룹명 없이 불리는 게 대부분)');

console.log(pass ? '\n✅ 활동명 성 떼기 테스트 통과' : '\n💥 활동명 성 떼기 테스트 실패');
process.exit(pass ? 0 : 1);
