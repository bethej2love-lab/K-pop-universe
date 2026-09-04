// 학습 로그 재생(replay) — "지금 매처가 사람 판단과 얼마나 맞는가"를 숫자로 낸다. (2026-09-04, Fable T4)
//
// 왜 필요한가: 매처를 고칠 때마다 "좋아졌을 것"이라는 감으로 배포해 왔다. 그런데 이 프로젝트의 사고는
// 대부분 "고친 게 다른 데를 망가뜨린" 형태였다(성-뗀 가드가 정상 태그 9,000건 삭제, 신뢰도 재스캔이
// 35,168건 오숨김). tag_edit_log에는 **사람이 무엇을 무엇으로 고쳤는지**가 쌓여 있으므로, 그 제목들에
// 현재 매처를 다시 돌려 사람 판단과 대조하면 "좋아졌는지"를 감이 아니라 수치로 볼 수 있다.
//
// 입력: 어드민 → 측정 → "📤 학습 로그 내보내기"로 받은 JSON.
// 실행: node tools/replay.mjs <파일.json> [--limit N] [--field group_ko|members] [--miss 20]
//
// ⚠️ 매처를 베끼지 않는다 — tools/m2_harness.js가 admin.js에서 실제 배포 함수를 슬라이스해 실행한다.
//    그래서 이 리포트는 항상 "지금 배포된 로직"의 성적이다(카피 드리프트 없음).
// ⚠️ 이건 정답표가 아니라 **사람 판단과의 일치율**이다. 사람이 틀렸을 수도 있고, 편집 로그는 "고친 것"만
//    담기므로 애초에 맞아서 손 안 댄 것은 여기 없다 — 즉 **가장 어려운 표본만 모인 집합**이다.
//    일치율이 낮게 나오는 게 정상이고, 봐야 할 것은 절대값이 아니라 **로직 변경 전후의 차이**다.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const { load } = require('./m2_harness');

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const file = args.find(a => !a.startsWith('--') && a !== opt('--limit') && a !== opt('--field') && a !== opt('--miss'));
if (!file) {
  console.log('사용법: node tools/replay.mjs <학습로그.json> [--limit N] [--field group_ko|members] [--miss 20]');
  process.exit(1);
}
if (!fs.existsSync(file)) { console.log('파일이 없어요: ' + path.resolve(file)); process.exit(1); }

const LIMIT = Number(opt('--limit', 0)) || 0;
const ONLY = opt('--field', null);
const MISS = Number(opt('--miss', 15)) || 15;

const payload = JSON.parse(fs.readFileSync(file, 'utf8'));
const rows = Array.isArray(payload) ? payload : (payload.rows || []);
if (!rows.length) { console.log('로그가 비어 있어요.'); process.exit(0); }

const M = load();

// ── 운영 규칙 싣기 ────────────────────────────────────────────────────────────
// ⚠️ 이걸 안 하면 재생 결과가 **실제 배포보다 관대**하다. 하니스는 DB에서 채워지는 동적 규칙
//    (흔한단어 보호 name_match_whitelist · 예외 규칙 atm_exception_rules)을 빈 채로 시작하기 때문이다.
//    2026-09-04에 그걸 모르고 "우리→고우리 오매칭이 아직 살아있다"고 오판했다 — 실제로는 고우리가
//    이미 보호 목록에 있어 막혀 있었고, 하니스에만 규칙이 없었던 것이다. 그 오판을 막으려고 넣는다.
//    두 테이블 모두 익명 읽기가 공개라(tests/rls.test.js) 키 없이 받아올 수 있다.
async function loadRules() {
  if (args.includes('--no-rules')) return { skipped: true };
  try {
    const html = fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..', 'index.html'), 'utf8');
    const url = (/SUPABASE_URL='([^']+)'/.exec(html) || [])[1];
    const key = (/SUPABASE_ANON_KEY='([^']+)'/.exec(html) || [])[1];
    if (!url || !key) return { error: 'index.html에서 Supabase 접속 정보를 못 찾음' };
    // ⚠️ Node의 fetch를 쓰면 안 된다 — 회사망 TLS 가로채기 환경에서 전부 `fetch failed`로 죽는다
    //    (헤드리스 브라우저는 멀쩡해서 "코드 문제"로 오해하기 쉽다). 이 레포의 다른 네트워크 도구
    //    (namu_link_sweep.mjs)와 같이 curl로 우회한다.
    const get = p => {
      const out = execFileSync('curl', ['-ks', '--max-time', '30',
        '-H', 'apikey: ' + key, '-H', 'Authorization: Bearer ' + key, `${url}/rest/v1/${p}`],
        { encoding: 'utf8', maxBuffer: 1024 * 1024 * 32 });
      return JSON.parse(out);
    };
    const wl = get('name_match_whitelist?select=name');
    (wl || []).forEach(r => r && r.name && M._ATM_DYNAMIC_HASHTAG_NAMES.add(r.name));
    const ex = get('atm_exception_rules?select=type,key,value');
    let nEx = 0;
    (ex || []).forEach(r => {
      if (!r || !r.type) return;
      if (r.type === 'surname_exclude') {
        if (!M._ATM_DYNAMIC_SURNAME_EXCLUDE.has(r.key)) M._ATM_DYNAMIC_SURNAME_EXCLUDE.set(r.key, new Set());
        (r.value || []).forEach(s => M._ATM_DYNAMIC_SURNAME_EXCLUDE.get(r.key).add(s));
      } else if (r.type === 'ambiguous_comatch') M._ATM_DYNAMIC_AMBIGUOUS_COMATCH.add(r.key);
      else if (r.type === 'literal_only') M._ATM_DYNAMIC_LITERAL_ONLY.add(r.key);
      else return;
      nEx++;
    });
    return { whitelist: (wl || []).length, rules: nEx };
  } catch (e) { return { error: e.message }; }
}
const ruleInfo = await loadRules();

const arr = v => Array.isArray(v) ? v : (v == null ? [] : [v]);
const sameSet = (a, b) => {
  const A = new Set(arr(a).map(String)), B = new Set(arr(b).map(String));
  if (A.size !== B.size) return false;
  for (const x of A) if (!B.has(x)) return false;
  return true;
};

// 재실행 대상: 사람이 실제로 그 필드를 고친 행만. 안 고친 필드는 "사람의 판단"이 없으므로 채점 불가.
const FIELDS = ['group_ko', 'members', 'with_members'];
const stat = {};
FIELDS.forEach(f => stat[f] = { n: 0, agree: 0, miss: [] });

let skippedNoTitle = 0, errored = 0, used = 0;
for (const r of rows) {
  if (LIMIT && used >= LIMIT) break;
  const title = r.title;
  if (!title) { skippedNoTitle++; continue; }
  const changed = arr(r.changed);
  const targets = FIELDS.filter(f => changed.includes(f) && (!ONLY || f === ONLY));
  if (!targets.length) continue;
  let res = null;
  try {
    // selfGko는 넘기지 않는다 — 이 재생은 "제목만 보고 판정할 때"의 성적을 재는 것이고,
    // 채널 소유자 정보(selfGko)를 주면 매처가 훨씬 쉬운 문제를 푸는 셈이라 비교가 왜곡된다.
    res = M._m2ParseTitle(title, undefined, false, r.published_at || undefined);
  } catch (e) { errored++; continue; }
  used++;
  for (const f of targets) {
    const human = (r.after || {})[f];
    let got;
    if (f === 'group_ko') got = res && res.primaryGroup;
    else if (f === 'members') got = (res && res.membersByGroup && res.membersByGroup[(r.after || {}).group_ko || (res && res.primaryGroup)]) || [];
    else { // with_members: "이름(그룹)" 포맷으로 맞춰 비교
      const wg = (res && res.withGroups) || [];
      got = wg.flatMap(g => ((res.membersByGroup || {})[g] || []).map(m => `${m}(${g})`));
    }
    const ok = f === 'group_ko' ? String(got || '') === String(human || '') : sameSet(got, human);
    stat[f].n++;
    if (ok) stat[f].agree++;
    else if (stat[f].miss.length < MISS) stat[f].miss.push({ title: String(title).slice(0, 74), human, got, id: r.video_id });
  }
}

console.log(`\n학습 로그 재생 — ${path.basename(file)}`);
console.log(`  로그 ${rows.length}건 · 재실행 ${used}건` + (skippedNoTitle ? ` · 제목 없어 제외 ${skippedNoTitle}` : '') + (errored ? ` · 매처 예외 ${errored}` : ''));
console.log('  운영 규칙: ' + (ruleInfo.skipped ? '⚠ 안 실음(--no-rules) — 실제 배포보다 관대하게 나옵니다'
  : ruleInfo.error ? `⚠ 못 실음(${ruleInfo.error}) — 실제 배포보다 관대하게 나옵니다`
  : `흔한단어 보호 ${ruleInfo.whitelist} · 예외 규칙 ${ruleInfo.rules}`));
console.log('');
let any = false;
for (const f of FIELDS) {
  const s = stat[f];
  if (!s.n) continue;
  any = true;
  const pct = (s.agree / s.n * 100).toFixed(1);
  console.log(`■ ${f} — 사람이 고친 ${s.n}건 중 현재 매처와 일치 ${s.agree}건 (${pct}%)`);
}
if (!any) { console.log('채점할 항목이 없어요 — changed에 group_ko/members/with_members가 있는 행이 없습니다.'); process.exit(0); }

for (const f of FIELDS) {
  const s = stat[f];
  if (!s.miss.length) continue;
  console.log(`\n[${f} 불일치 표본 ${s.miss.length}건]`);
  s.miss.forEach(m => {
    const h = Array.isArray(m.human) ? m.human.join(',') : String(m.human ?? '');
    const g = Array.isArray(m.got) ? m.got.join(',') : String(m.got ?? '');
    console.log(`  · ${m.title}\n      사람: ${h || '(없음)'}\n      매처: ${g || '(없음)'}`);
  });
}
console.log('\n⚠️ 이 수치는 정답률이 아니라 **사람 판단과의 일치율**입니다. 편집 로그엔 "고친 것"만 담기므로');
console.log('   애초에 맞아서 손 안 댄 건 여기 없어요 — 가장 어려운 표본만 모인 집합입니다.');
console.log('   절대값보다 **로직 변경 전후의 차이**를 보세요.');
